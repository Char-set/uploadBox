import * as React from 'react';
import SparkMD5 from 'spark-md5';

import * as _api from '../../api/index';
import './Upload.less';

import {apiHost} from '../../../../.config/config.base'

const { useState, useEffect, useRef } = React;

function getUid() {
    let index = 0;
    let now = +new Date();
    return function() {
        return `upload-${now}-${index++}`
    }
}

function getBody(xhr) {
    const text = xhr.responseText || xhr.response;
    if (!text) {
        return text;
    }

    try {
        return JSON.parse(text);
    } catch (e) {
        return text;
    }
}

const _getUid = getUid();

const PieceSize = 4 * 1024 * 1024;

const method = 'post';
const action = `${apiHost}/file/upload`;

const Status = {
    WAIT:0,
    UPLOADING:1,
    DONE:2,
    ERROR:3
}

const FileItem = ({name,progress}) => {
    return (
        <div className="upload_item">
            <div className="upload_progress" style={{height: progress > 0 ? '2px' : ''}}>
                <div className="progress_line" style={{height: progress > 0 ? '2px' : '', width: progress + '%'}}></div>
            </div>
            <div className="attachment">
                <img src={require('../../assets/attachment_icon.svg').default} className="attachment_icon" alt="" />
            </div>
            <div className="file_text">{name}</div>
            <div className="delete">
                <img src={require('../../assets/delete_icon.svg').default} className="delete_icon" alt="" />
            </div>
        </div>
    )
}


export default () => {

    const [uploadList, setUploadList] = useState([]);

	const FileInput = useRef(null)

    useEffect(() => {
        _api.checkApi();
    },[]);
	const _handleFileDrop = (e) => {
		e.preventDefault();
		if(e.type === 'dragover') return;
		const acceptFiles = [...e.dataTransfer.files].filter((file) =>
			true
		);

		_uploadFiles(acceptFiles);
	}
	// 文件变化监听
	const _handleFileChange = (e) => {
		const { files = [] } = e.target;

		const acceptFiles = [...(files)].filter(file => {
			// debugger
			return true;
		});
		_uploadFiles(acceptFiles);

		// this.fileInput.value = null;
		// this.reset();
	}

	const _uploadFiles = (files) => {
		if(!files || files.length === 0) return;
		const originFiles = [...files];
		const postFiles = originFiles.map(file => {


			file.uid = _getUid();

			return _createUploadPromise(file);
		});

		Promise.all(postFiles).then(res => {
			console.log(res)
		})
	}
	// 文件上传
	const  _createUploadPromise = async (file) => {
		if(!file) return false;

		try {
            let chunks = _getChunks(file);

            let totalPieces = chunks.length;
            let fileSize = file.size;

            console.time('calculateFileTime')
            // 计算文件md5

            // 普通模式
            // let fileMd5 = await _calculateFileMd5(chunks);

            // requestIdeCallback模式
            // let fileMd5 = await _calculateHashIdeBack(chunks);

            // 抽样模式
            let fileMd5 = await _calculateHashSampling(file);

            console.timeEnd('calculateFileTime');
            // return;
            // await _getFileType(file);

            let { status, leftPieces} = await _checkFile(fileMd5, file.name, chunks);
            if(status == 'file need continue upload') {
                chunks = leftPieces;
                fileSize = chunks.reduce((prev, current) => {
                    return prev + (current.end - current.start);
                },0);
            }

            // let tempArr = [...uploadList,{
            //     fileName: file.name,
            //     progress:0,//
            //     file,
            //     fileMd5,
            // }]
            // setUploadList(tempArr)

            setUploadList(prev => {
                let tempArr = [...prev,{
                    fileName: file.name,
                    progress:0,//
                    file,
                    fileMd5,
                }]
                return tempArr;
            });
            let upIdx = uploadList.length;

            let fileList = chunks.map((item,idx) => {
                return {
                    target: action,
                    params: {
                        file:item.file,
                        fileName: file.name,
                        fileMd5,
                        chunks: chunks.length,
                        chunkNth: item.index,
                        fileTotalSize: fileSize
                    },
                    status: Status.WAIT,
                    otherParams: upIdx
                }
            });


            await _creatUploadRequestLimit(fileList, 4, (progress) => {
                // uploadList[upIdx].progress = 100;
                // let newArr = [...uploadList];
                // newArr[upIdx].progress = progress / fileSize;
                // setUploadList(uploadList);
                setUploadList(prev => {
                    let tempArr = [...prev];
                    tempArr[upIdx].progress = progress / fileSize * 100;
                    return tempArr;
                });
            });

            // console.log('上传完成');
            await _api.merge_chunk({
                fileName: file.name,
                fileMd5,
                chunksTotal:totalPieces
            });
        } catch (error) {
            if(error == 'file exist') {
                return false;
            }
            error && console.error(error);
        }
	}

	const _getChunks = (file) => {
		let fileSize = file.size;
		let count = Math.ceil(fileSize / PieceSize);
		let chunks = [];
		let start = 0, end;
		let blobSlice = File.prototype.slice;
		for(let i = 0; i < count; i++) {
			if(i == count - 1) {
				end = fileSize;
			} else {
				end = start + PieceSize;
			}
			let json = {
				index: i,
				start,
				end,
				isok: false,
				file: blobSlice.call(file, start, end)
			};
			chunks.push(json);

			start = end;
		}
		return chunks;
	}
	// 抽样计算hash
	const _calculateHashSampling = (file) => {
		return new Promise((rl,rj) => {
			const spark = new SparkMD5.ArrayBuffer();
			const fileReader = new FileReader();
			const size = file.size;
			const offset = PieceSize;
			let chunks = [file.slice(0, offset)];

			let cur = offset;

			while(cur < size) {
				if(cur + offset >= size) {
					chunks.push(file.slice(cur, cur + offset));
				} else {
					const min = cur + offset / 2;
					const end = cur + offset;

					chunks.push(file.slice(cur, cur + 2))
					chunks.push(file.slice(min, min + 2))
					chunks.push(file.slice(end - 2, end))
				}
				cur += offset;
			}

			fileReader.onload = (e) => {
				spark.append(e.target.result);
				rl(spark.end())
			}

			fileReader.readAsArrayBuffer(new Blob(chunks))

		})
	}
	// 计算文件Md5 SparkMD5
	const _calculateFileMd5 =  async (chunks) => {
		return new Promise((rl, rj) => {
			var
				chunksTotal = chunks.length,
				currentChunk = 0,
				spark = new SparkMD5.ArrayBuffer(),
				fileReader = new FileReader();

			fileReader.onload = function (e) {
				// console.log('read chunk nr', currentChunk + 1, 'of', chunks);
				spark.append(e.target.result);                   // Append array buffer
				currentChunk++;

				if (currentChunk < chunksTotal) {
					loadNext();
				} else {
					let fileMd5 = spark.end();
					console.log('finished loading');
					console.info('computed hash', fileMd5);  // Compute hash
					rl(fileMd5);
				}
			};

			fileReader.onerror = function () {
				console.warn('oops, something went wrong.');
			};

			function loadNext() {

				fileReader.readAsArrayBuffer(chunks[currentChunk].file);
			}

			loadNext();
		})
	}

	// 利用 浏览器渲染当前帧的空闲时间去计算，防止卡顿(计算时间更长)
	const _calculateHashIdeBack = (chunks) => {
		return new Promise((rl, rj) => {
			const spark = new SparkMD5.ArrayBuffer();
			const len = chunks.length;
			let count = 0;
			let fileReader = new FileReader();
			const appendToSpark = async (file) => {
				return new Promise((rl, rj) => {
					fileReader.onload = (e) => {
						spark.append(e.target.result);                   // Append array buffer
						rl(true);
					}
					fileReader.readAsArrayBuffer(file);
				});
			}
			const workLoop = async (deadline) => {
				while(count < len && deadline.timeRemaining() > 1) {
					console.log(`current:${count}/${len}`)
					await appendToSpark(chunks[count].file);
					count++;
					if(count < len) {
                        console.log(count)
					} else {
						rl(spark.end())
					}
				}
				if(count < len) {

					window.requestIdleCallback(workLoop);
				}
				// if(timeRemaining == 0) {
				//     console.log(`浏览器没时间执行咱的任务，等下次有空计算第${count}个任务`)
				// }
			}
			window.requestIdleCallback(workLoop);
		})
	}

    // 获取文件类型
    const _getFileType = (file) => {
        return new Promise((rl, rj) => {
            const reader = new FileReader();
            reader.readAsArrayBuffer(file);
            reader.onload = event => {
                let array = new Uint8Array(event.target.result);
                array = array.slice(0, 4);
                let arr = [...array]
                let key = arr.map(item => item.toString(16)
                    .toUpperCase()
                    .padStart(2, '0'))
                    .join('');
                rl(key)
            }
        })
    }

    // 检查文件是否已上传完成或部分
    const _checkFile = (fileMd5,fileName, filePieces) => {
        return new Promise(async(rl, rj) => {
            try {
                let { data: checkData } = await _api.checkFile({
                    fileMd5,
                    fileName,
                    filePieces
                });
                let { status, leftPieces} = checkData;

                if(status === 'file exist') {
                    setUploadList(prev => {
                        let tempArr = [...prev,{
                            fileName,
                            progress:100,//
                            fileMd5,
                        }];
                        return tempArr;
                    })
                    rj(status);
                } else {
                    rl({status, leftPieces});
                }
            } catch (error) {
                error && console.error(error);
                error && rj(error);
            }
        })
    }
    // 发起上传请求
    const _creatUploadRequest = (fileObj, onProgress) => {
        return new Promise((rl, rj) => {
            const xhr = new XMLHttpRequest();
            if(xhr.upload) {
                xhr.upload.onprogress = function progress(e) {
                    if(e.total > 0) {

                        // _this.uploadList[upIdx].progressList[fileObj.chunkNth] = (e.loaded / fileObj.fileTotalSize) * 100;
                        // _this.$set(_this.uploadList[upIdx].progressList, fileObj.chunkNth, (e.loaded / fileObj.fileTotalSize) * 100)
                        onProgress && onProgress(e.loaded)
                    }
                }
            }
            const formData = new FormData();

            formData.append('file', fileObj.file);
            formData.append('fileName', fileObj.fileName);
            formData.append('fileMd5', fileObj.fileMd5);
            formData.append('chunks', fileObj.chunks);
            formData.append('chunkNth', fileObj.chunkNth);

            xhr.onerror = function error(e) {
                console.error(e);
                rj(e);
            }

            xhr.onload = function onload() {
                if(xhr.status < 200 || xhr.status >= 300) {
                    console.error(`cannot ${method} ${action} ${xhr.status}'`);
                    rj();
                    return;
                }

                rl(getBody(xhr));
            }

            xhr.open(method, action, true);

            if('withCredentials' in xhr) {
                // xhr.withCredentials = true;
            }

            const headers = {};

            // when set headers['X-Requested-With'] = null , can close default XHR header
            // see https://github.com/react-component/upload/issues/33
            if (headers['X-Requested-With'] !== null) {
                xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
            }

            Object.keys(headers).forEach(h => {
                if (headers[h] !== null) {
                    xhr.setRequestHeader(h, headers[h]);
                }
            });
            xhr.send(formData);
        })
    }
    // 限制同时发起的request 只有4个
    const _creatUploadRequestLimit = (list = [], max = 6, progressCallback = () => {} ) => {
        return new Promise((rl,rj) => {
            let count = 0;
            let currentMax = list.length > max ? max : list.length;
            let ans = [];
            let progressList = [];
            let errorList = [];
            const len = list.length;
            const _start = () => {
                while(count < list.length && currentMax > 0) {
                    currentMax--;
                    let i = list.findIndex(item => item.status == Status.WAIT || item.status == Status.ERROR);

                    if(typeof errorList[i] === 'number') {
                        console.info(`尝试第${errorList[i]}次`)
                        errorList[i]++;

                        if(errorList[i] > 3) {
                            rj(`文件${JSON.stringify(list[i])}上传失败`);
                            return;
                        }
                    }

                    if(i == -1) break;
                    list[i].status = Status.UPLOADING;

                    _creatUploadRequest(list[i].params, (progress) => {
                        progressList[i] = progress;
                        progressCallback && progressCallback(progressList.reduce((prev, current) => {
                            return prev + current;
                        },0))
                    })
                    .then(res => {
                        ans[i] = res;
                        count++;
                        currentMax++;
                        list[i].status = Status.DONE;
                        if(count == len){
                            rl(ans);
                        } else {
                            _start();
                        }
                    })
                    .catch(error => {
                        // 切片上传失败重试
                        list[i].status = Status.ERROR;
                        if(!errorList[i]) errorList[i] = 1;
                        currentMax++;
                        if(count < len) {
                            _start();
                        }
                    })

                }
            }
            _start();
        })
    }


    const _renderUploadList = () => {
        return uploadList.map((file,idx) => {
            return(
                <FileItem key={file.fileMd5 + idx} name={file.fileName} progress={file.progress} />
            )
        })
    }

	return (
		<div className="container">
			<div className="custom_upload" onDrop={_handleFileDrop} onDragOver={_handleFileDrop} onClick={() => (FileInput.current).click()}>
				<div className="upload_progress">
					<div className="progress_line"></div>
				</div>
				<input type="file" ref={FileInput} onChange={_handleFileChange} className="file_input" />
				<div className="upload_content">
					<img src={require('../../assets/upload_icon.svg').default} className="upload_icon" alt="" />
					<div className="upload_desc">Click or drag file to this area to upload</div>
				</div>
			</div>

			<div className="upload_list">
                {_renderUploadList()}
			</div>
		</div>
	)
}
