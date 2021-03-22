import {createGuid} from './Utils'

let loadingGroup = [];

let loadingToast = ''

const toQueryString = (obj) => {
    return obj ? Object.keys(obj).sort().map(function (key) {
        var val = obj[key];
        if (Array.isArray(val)) {
            return val.sort().map(function (val2) {
                return encodeURIComponent(key) + '=' + encodeURIComponent(val2);
            }).join('&');
        }

        return encodeURIComponent(key) + '=' + encodeURIComponent(val);
    }).join('&') : '';
}

const get = (url,params,noloading,noToast,isLocalRequest=true) => {
    //fetch请求
    if (params) {
        let paramsArray = [];
        //拼接参数
        Object.keys(params).forEach(key => paramsArray.push(key + '=' + params[key]))
        if (url.search(/\?/) === -1) {
            url += '?' + paramsArray.join('&')
        } else {
            url += '&' + paramsArray.join('&')
        }
    }
    return doRequest('GET',null,url,null,noloading,noToast,isLocalRequest);
    
}
const post = (url,params,noloading,noToast) => {
    //fetch请求
    let header = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };
    return doRequest('POST',header,url,JSON.stringify(params),noloading,noToast);
}

const deleteApi = (url,params,noloading) => {
    //fetch请求
    return doRequest('DELETE',null,url,JSON.stringify(params),noloading);
}
const deleteJson = (url,params,noloading) => {
    //fetch请求
    let header = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };
    return doRequest('DELETE',header,url,JSON.stringify(params),noloading);
}

const put = (url,params,noloading) => {
    //fetch请求
    let header = {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    return doRequest('PUT',header,url,toQueryString(params),noloading);
    
}
/*
    *  postForm 表单请求
    *  url:请求地址
    *  params:参数
    * */
const postForm = (url,params,noloading) => {
    //fetch请求
    let header = {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    return doRequest('POST',header,url,toQueryString(params),noloading);
}
/**
 * 发起接口请求
 * @methods 请求方式
 * @headers 请求头
 * @url 请求地址 相对路径
 * @params 请求入参
 */
const doRequest = (methods,headers,url,params,noloading,noToast,isLocalRequest=true) => {
    if(!/^http(s)?:\/\//.test(url)){
        url = process.env._APP_apiHost + url;
    }
    headers = headers?headers:{};
    let loadingUid = createGuid();
    return new Promise((rl,rj) =>{
        let options = {
            method: methods,
            headers:isLocalRequest ? (headers || {}) : {}
        }
        if(methods != 'GET'){
            options.body = params;
        }
        if(!noloading){
            // if(!loadingGroup.length) {

            // }
            loadingGroup.push({
                id:loadingUid,
                timeStr: new Date().valueOf()
            })
            
        }
        fetch(url,options)
        .then((response) => {
            let loadingIdx = loadingGroup.findIndex(item => {
                return item.id == loadingUid
            })
            loadingGroup.splice(loadingIdx,1)
            setTimeout(() => {
                if(!loadingGroup.length) {
                    loadingToast && loadingToast.clear();
                } 
            }, 800);
            if(response.status == 404){
                console.log('服务不见咯');
                rj()
            } else{
                return response.json();
            }
        })
        .then((responseJSON) => {
            if (isSuccessful(responseJSON)) {
                rl(responseJSON)
            } else {
                rj(responseJSON);
                // if(process.env.NODE_ENV === 'development'){
                    _hanleError(responseJSON,noToast);
                // }
            }
        }) 
        .catch((error) => {
            console.log(error)
        });
    })
}
/**
 * 判断请求返回是成功还是失败
 */
const isSuccessful = (response) => {
    if(!response){
        return false;
    }
    var data = response;
    //JSON格式的数据
    if (data && (Object.prototype.hasOwnProperty.call(data, "code") || Object.prototype.hasOwnProperty.call(data, "Code") || Object.prototype.hasOwnProperty.call(data, "success"))) {
        if(data.code == "200" || data.Code == "200" || data.success){
            return true;
        }
    }

    //非JSON数据
    if (response.status >= 200 && response.status <= 300) {
        return true;
    }

    return false;
}
/**
 * 提示错误信息
 */
const _hanleError = (response,noToast) => {
    let msg = response && response.msg ? response.msg : "请求出错，请稍后再试";
    // if(response && response.code == 4000){
        
    // }
    if(!noToast) {
        // Toast(msg);
    }
}
export {
    get,
    post,
    postForm,
}