<template>
    <div class="container">
        <div class="custom_upload" @paste="_handlePasteFile" @click="_hanldeClick" @drop="_handleFileDrop" @dragover="_handleFileDrop">
            <div class="upload_progress" :style="{height: precent > 0 ? '2px' : ''}">
                <div class="progress_line" :style="{height: precent > 0 ? '2px' : '', width: precent + '%'}"></div>
            </div>
            <input type="file" ref="file_input" class="file_input" :key="uid" :id="uid" @change="_handleFileChange">
            <div class="upload_content">
                <img src="../assets/upload_icon.svg" class="upload_icon" alt="">
                <div class="upload_desc">Click or drag file to this area to upload</div>
            </div>
        </div>
        <div class="upload_list">
            <div class="upload_item" v-for="(file, idx) in uploadList" :key="file.fileMd5 + idx">
                <div class="upload_progress" :style="{height: progressList[idx] > 0 ? '2px' : ''}">
                    <div class="progress_line" :style="{height: progressList[idx] > 0 ? '2px' : '', width: progressList[idx] + '%'}"></div>
                </div>
                <div class="attachment">
                    <img src="../assets/attachment_icon.svg" class="attachment_icon" alt="">
                </div>
                <div class="file_text">{{file.fileName}}</div>
                <div class="delete">
                    <img src="../assets/delete_icon.svg" class="delete_icon" alt="">
                </div>
            </div>
        </div>
        <div class="time_ount">{{timeCount}}</div>
    </div>
</template>

<script>
function getUid() {
    let index = 0;
    let now = +new Date();
    return function() {
        return `upload-${now}-${index++}`
    }
}

const _getUid = getUid();

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

const pieceSize = 2 * 1024 * 1024;

const upMemberMax = 3;

const method = 'post';
const action = '/api/file/upload';

const Status = {
    wait:0,
    uploading:1,
    done:2,
    error:3
}

import SparkMD5 from 'spark-md5';
export default {
    data() {
        return {
            accept:'*',
            precent: 0,
            uid: '',
            uploadList:[],//
            timeCount:0
        }
    },
    computed: {
        progressList() {
            return this.uploadList.map(item => {
                return Math.min(100, item.progressList.reduce((prev, current,) => {
                    return prev + current;
                },0))
            })
        }
    },
    methods: {
        reset() {
            this.uid = _getUid();
        },
        // 点击事件监听
        _hanldeClick() {
            this.fileInput.click();
        },
        // 粘贴事件监听
        _handlePasteFile(e) {
            console.log(e)

            const { items } = e.clipboardData;

            let acceptFiles = [...items].filter((file) =>{
                return file.kind === 'file'
            }).map(item => item.getAsFile()).filter(file => file);

            this._uploadFiles(acceptFiles);
        },
        // 拖拽事件监听
        _handleFileDrop(e) {
            e.preventDefault();
            if(e.type === 'dragover') return;
            let acceptFiles = [...e.dataTransfer.files].filter((file) =>
                true
            );
            this._uploadFiles(acceptFiles);
        },
        // 文件变化监听
        _handleFileChange(e) {
            const { files } = e.target;
            const acceptFiles = [...files].filter(file => {
                // debugger
                return true;
            });

            this._uploadFiles(acceptFiles);

            this.fileInput.value = null;
            this.reset();
        },
        // 处理文件
        _uploadFiles(files) {
            if(!files || files.length === 0) return;
            const originFiles = [...files];
            const postFiles = originFiles.map(file => {
                
                file.uid = _getUid();
                return this._createUploadPromise(file);
            });

            Promise.all(postFiles).then(res => {
                
            })
        },
        // 获取文件切片数据
        _getChunks(file) {
            let fileSize = file.size;
            let count = Math.ceil(fileSize / pieceSize);
            let chunks = [];
            let start = 0, end;
            let blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice;
            for(let i = 0; i < count; i++) {
                if(i == count - 1) {
                    end = fileSize;
                } else {
                    end = start + pieceSize;
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
        },
        // 获取文件类型
        _getFileType(file) {
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
        },
        // 计算文件Md5 SparkMD5
        async _calculateFileMd5(chunks) {
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
        },
        // 利用 浏览器渲染当前帧的空闲时间去计算，防止卡顿(计算时间更长)
        _calculateHashIdeBack(chunks) {
            return new Promise((rl, rj) => {
                const spark = new SparkMD5.ArrayBuffer();
                const len = chunks.length;
                let count = 0;
                let fileReader = new FileReader();
                const appendToSpark = async file => {
                    return new Promise((rl, rj) => {
                        fileReader.onload = e => {
                            spark.append(e.target.result);                   // Append array buffer
                            rl();
                        }
                        fileReader.readAsArrayBuffer(file);
                    });
                }
                const workLoop = async deadline => {
                    while(count < len && deadline.timeRemaining() > 1) {
                        console.log(`current:${count}/${len}`)
                        await appendToSpark(chunks[count].file);
                        count++;
                        if(count < len) {
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
        },
        _calculateHashSampling(file) {
            return new Promise((rl,rj) => {
                const spark = new SparkMD5.ArrayBuffer();
                const fileReader = new FileReader();
                const size = file.size;
                const offset = pieceSize;
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

                fileReader.onload = e => {
                    spark.append(e.target.result);
                    rl(spark.end())
                }

                fileReader.readAsArrayBuffer(new Blob(chunks))

            })
        },
        // 文件上传
        _createUploadPromise(file) {
            if(!file) return false;
            
            return new Promise(async (rl,rj) => {
                try {
                    let chunks = this._getChunks(file);
                    let totalPieces = chunks.length;
                    let fileSize = file.size;

                    let startTime = new Date().valueOf();
                    console.log('startTime:',startTime)
                    // 计算文件md5

                    // 普通模式
                    // let fileMd5 = await this._calculateFileMd5(chunks);

                    // requestIdeCallback模式
                    // let fileMd5 = await this._calculateHashIdeBack(chunks);

                    // 抽样模式
                    let fileMd5 = await this._calculateHashSampling(file);

                    let endTime = new Date().valueOf();
                    console.log('endTime:',endTime);
                    console.log('文件计算Md5distanceTime:',endTime - startTime);
                    // return;
                    // await this._getFileType(file);
                    
                    let { status, leftPieces} = await this._checkFile(fileMd5, file.name, chunks);

                    if(status == 'file need continue upload') {
                        chunks = leftPieces;
                        fileSize = chunks.reduce((prev, current) => {
                            return prev + (current.end - current.start);
                        },0);
                    }

                    //
                    this.uploadList.push({
                        fileName: file.name,
                        progress:0,//
                        file,
                        fileMd5,
                        progressList: new Array(chunks.length).fill(0),//
                    })
                    let uploadPro = [];
                    let upIdx = this.uploadList.length - 1;

                    let uploadList = chunks.map((item,idx) => {
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
                            status: Status.wait,
                            otherParams: upIdx
                        }
                    });


                    await this._creatUploadRequestLimit(uploadList, 4, () => {});
                    
                    console.log('上传完成');
                    // await this._api.merge_chunk({
                    //     fileName: file.name,
                    //     fileMd5,
                    //     chunksTotal:totalPieces
                    // });
                    // rl();
                } catch (error) {
                    if(error == 'file exist') {
                        rl();
                    }
                    error && console.error(error);
                }
            })
        },
        // 检查文件是否已上传完成或部分
        _checkFile(fileMd5,fileName, filePieces) {
            return new Promise(async (rl,rj) => {
                try {
                    let { data: checkData } = await this._api.checkFile({
                        fileMd5,
                        fileName,
                        filePieces
                    });
                    let { status, leftPieces} = checkData;

                    if(status === 'file exist') {
                        this.uploadList.push({
                            fileName,
                            progress:0,//
                            // file,
                            fileMd5,
                            progressList: [100],//
                        });
                        rj(status);
                    } else {
                        rl({status, leftPieces});
                    }
                } catch (error) {
                    rj(error);
                    console.error(error);
                }
            })
        },
        // 发起上传请求
        async _creatUploadRequest(fileObj, upIdx) {
            const _this = this;
            return new Promise((rl, rj) => {
                const xhr = new XMLHttpRequest();
                if(xhr.upload) {
                    xhr.upload.onprogress = function progress(e) {
                        if(e.total > 0) {
                            let precent = (e.loaded / e.total) * 100;
                            // _this.precent = precent;
                            // console.log('precent:', precent)
                            if(precent == 100) {
                                console.log(precent * (e.total / fileObj.fileTotalSize));
                            }
                            // _this.uploadList[upIdx].progressList[fileObj.chunkNth] = (e.loaded / fileObj.fileTotalSize) * 100;
                            _this.$set(_this.uploadList[upIdx].progressList, fileObj.chunkNth, (e.loaded / fileObj.fileTotalSize) * 100)
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
                    xhr.withCredentials = true;
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
        },
        // 限制同时发起的request 只有4个
        _creatUploadRequestLimit(list = [], max = 4, callback = () => {} ) {
            return new Promise((rl,rj) => {
                let count = 0;
                let currentMax = max;
                let ans = [];
                const len = list.length;
                const _start = () => {
                    while(count < list.length && currentMax > 0) {
                        currentMax--;
                        let i = list.findIndex(item => item.status == Status.wait || item.status == Status.error);

                        list[i].status = Status.uploading;

                        this._creatUploadRequest(list[i].params, list[i].otherParams)
                        .then(res => {
                            ans[i] = res;
                            count++;
                            currentMax++;
                            list[i].status = Status.done;
                            if(count == len){
                                rl(ans);
                            } else {
                                _start();
                            }
                        })
                        .catch(res => {

                        })

                    }
                }
                _start();
            })
        }
    },
    mounted() {
        this.reset();
        this.fileInput = this.$refs.file_input;
        this.$nextTick(() => {
            document.addEventListener('paste', (event) => {
                this._handlePasteFile(event);
            })
        });
        // setInterval(() => {
        //     this.timeCount = new Date().valueOf();
        // }, 10);
    }
}
</script>

<style lang="scss">
    .container{
        display: flex;
        // justify-content: center;
        align-items: center;
        min-height: 100vh;
        flex-direction: column;
        .custom_upload{
            display: inline-block;
            width: 390px;
            height: 180px;
            background: #fafafa;
            border: 1px dashed #d9d9d9;
            border-radius: 2px;
            cursor: pointer;
            text-align: center;
            padding: 20px 0;
            box-sizing: border-box;
            position: relative;
            transition: border-color .3s;
            overflow: hidden;
            .upload_progress{
                position: absolute;
                height: 2px;
                width: 100%;
                left: 0;
                top: 1px;
                z-index: 9;
                background: #f5f5f5;
                transition: height .3s;
                .progress_line{
                    height: 2px;
                    width: 30%;
                    background: #67C23A;
                    transition: width .2s;
                }
            }
            &:hover{
                border-color: #40a9ff;
            }
            .file_input{
                position: absolute;
                width: 100%;
                height: 100%;
                left: 0;
                top: 0;
                opacity: 0;
                z-index: 10;
                cursor: pointer;
                display: none;
            }
        }
        .upload_list{
            width: 390px;
            .upload_item{
                margin-top: 8px;
                display: flex;
                align-items: center;
                cursor: pointer;
                transition: background-color .3s;
                padding: 5px;
                &:hover{
                    background: #fff;
                }
                position: relative;
                .upload_progress{
                    position: absolute;
                    height: 2px;
                    width: 100%;
                    left: 0;
                    top: 1px;
                    z-index: 9;
                    background: #f5f5f5;
                    transition: height .3s;
                    .progress_line{
                        height: 2px;
                        width: 30%;
                        background: #67C23A;
                        transition: width .2s;
                    }
                }
                .attachment{
                    width: 16px;
                    height: 16px;
                    .attachment_icon{
                        display: block;
                        width: 100%;
                        height: 100%;
                    }
                }
                .file_text{
                    font-size: 14px;
                    flex: 1;
                    box-sizing: border-box;
                    padding: 0 10px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .delete{
                    width: 16px;
                    height: 16px;
                    .delete_icon{
                        display: block;
                        width: 100%;
                        height: 100%;
                    }
                }
            }
        }
    }
</style>>
