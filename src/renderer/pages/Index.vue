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

const sliceMax = 200 * 1024 * 1024;

const upMemberMax = 3;

const method = 'post';
const action = '/api/file/upload';

import SparkMD5 from 'spark-md5';
export default {
    data() {
        return {
            accept:'*',
            precent: 0,
            uid: '',
            uploadList:[],//

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
        _hanldeClick() {
            this.fileInput.click();
        },
        _handlePasteFile(e) {
            console.log(e)

            const { items } = e.clipboardData;

            let acceptFiles = [...items].filter((file) =>{
                return file.kind === 'file'
            }).map(item => item.getAsFile()).filter(file => file);

            this._uploadFiles(acceptFiles);
        },
        _handleFileDrop(e) {
            e.preventDefault();
            if(e.type === 'dragover') return;
            let acceptFiles = [...e.dataTransfer.files].filter((file) =>
                true
            );
            this._uploadFiles(acceptFiles);
        },
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
        _uploadFiles(files) {
            if(!files || files.length === 0) return;
            const originFiles = [...files];
            const postFiles = originFiles.map(file => {
                
                file.uid = _getUid();
                return this._createUploadPromise(file);
            });

            Promise.all(postFiles).then(res => {
                // debugger
            })
        },
        _getFilesSlice(file) {
            let fileSize = file.size;
            let count = Math.ceil(fileSize / sliceMax);
            let fileslice = [];
            let start = 0, end;
            for(let i = 0; i < count; i++) {
                if(i == count - 1) {
                    end = fileSize;
                } else {
                    end = start + sliceMax;
                }
                let json = {
                    index: i,
                    start,
                    end,
                    isok: false
                };
                fileslice.push(json);

                start = end;
            }

            console.log(fileslice);
            return fileslice;
        },
        async _calculateFileMd5(file) {
            return new Promise((rl, rj) => {
                var blobSlice = File.prototype.slice || File.prototype.mozSlice || File.prototype.webkitSlice,
                    chunkSize = 2097152,                             // Read in chunks of 2MB
                    chunks = Math.ceil(file.size / chunkSize),
                    currentChunk = 0,
                    spark = new SparkMD5.ArrayBuffer(),
                    fileReader = new FileReader();
            
                fileReader.onload = function (e) {
                    console.log('read chunk nr', currentChunk + 1, 'of', chunks);
                    spark.append(e.target.result);                   // Append array buffer
                    currentChunk++;
            
                    if (currentChunk < chunks) {
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
                    var start = currentChunk * chunkSize,
                        end = ((start + chunkSize) >= file.size) ? file.size : start + chunkSize;
            
                    fileReader.readAsArrayBuffer(blobSlice.call(file, start, end));
                }
            
                loadNext();
            })
        },
        _createUploadPromise(file) {
            if(!file) return false;
            
            return new Promise(async (rl,rj) => {
                
                let fileSlices = this._getFilesSlice(file);
                let totalPieces = fileSlices.length;
                let fileSize = file.size;
                // 计算文件md5
                let fileMd5 = await this._calculateFileMd5(file);
                
                let { status, leftPieces} = await this._checkFile(fileMd5, file.name, fileSlices);

                if(status == 'file need continue upload') {
                    fileSlices = leftPieces;
                    fileSize = fileSlices.reduce((prev, current) => {
                        return prev + (current.end - current.start);
                    },0);
                }

                //
                this.uploadList.push({
                    fileName: file.name,
                    progress:0,//
                    file,
                    fileMd5,
                    progressList: new Array(fileSlices.length).fill(0),//
                })
                let uploadPro = [];
                let upIdx = this.uploadList.length - 1;
                // if(fileSlices < 2) {
                //     this._creatUploadRequest({
                //         file,
                //         fileName: file.name,
                //         fileMd5,
                //         chunks: fileSlices.length,
                //         chunkNth: 1,
                //         fileTotalSize: file.size
                //     }, upIdx)
                // } else {
                    
                // }
                for(let i = 0; i < fileSlices.length; i++) {
                    let fileBinary = file.slice(fileSlices[i].start, fileSlices[i].end);
                    uploadPro.push(this._creatUploadRequest({
                        file:fileBinary,
                        fileName: file.name,
                        fileMd5,
                        chunks: fileSlices.length,
                        chunkNth: fileSlices[i].index,
                        fileTotalSize: fileSize
                    }, upIdx));
                }
                await Promise.all(uploadPro);
                console.log('上传完成');
                this._api.merge_chunk({
                    fileName: file.name,
                    fileMd5,
                    chunksTotal:totalPieces
                });
            })
        },
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
                        rj();
                    } else {
                        rl({status, leftPieces});
                    }
                    // if(status == 'file not exist') {
                    //     rl({status});
                    // } else if(status == 'file need continue upload') {
                    //     // fileSlices = leftPieces;
                    //     // fileSize = fileSlices.reduce((prev, current) => {
                    //     //     return prev + (current.end - current.start);
                    //     // },0);
                    //     rl({status, leftPieces});
                    // } else if(status == 'file exist') {
                    //     this.uploadList.push({
                    //         fileName,
                    //         progress:0,//
                    //         // file,
                    //         fileMd5,
                    //         progressList: [100],//
                    //     });
                    //     rj();
                    //     return;
                    // }
                } catch (error) {
                    rj();
                    console.error(error);
                }
            })
        },
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
        }
    },
    mounted() {
        this.reset();
        this.fileInput = this.$refs.file_input;
        this.$nextTick(() => {
            document.addEventListener('paste', (event) => {
                this._handlePasteFile(event);
            })
        })
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
