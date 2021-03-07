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

const method = 'post';
const action = '/api/upload';

import {filesSlice} from '../utils/index'
export default {
    data() {
        return {
            accept:'*',
            precent: 0,
            uid: '',
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
                filesSlice(file)
                file.uid = _getUid();
                return this._createUploadPromise(file);
            });

            Promise.all(postFiles).then(res => {
                // debugger
            })
        },
        _createUploadPromise(file) {
            if(!file) return false;
            const _this = this;

            return new Promise((rl,rj) => {




                const xhr = new XMLHttpRequest();
                if(xhr.upload) {
                    xhr.upload.onprogress = function progress(e) {
                        if(e.total > 0) {
                            let precent = (e.loaded / e.total) * 100;
                            _this.precent = precent;
                            console.log('precent:', precent)
                        }
                    }
                }

                const formData = new FormData();

                formData.append('file', file);

                xhr.onerror = function error(e) {
                    console.error(e);
                }

                xhr.onload = function onload() {
                    if(xhr.status < 200 || xhr.status >= 300) {
                        console.error(`cannot ${method} ${action} ${xhr.status}'`);

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
        justify-content: center;
        align-items: center;
        min-height: 100vh;
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
            position: absolute;
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
    }
</style>>
