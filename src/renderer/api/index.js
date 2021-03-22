import {get, post, postForm} from '../utils/Http'

const merge_chunk = async params => post(`/file/merge_chunk`,{
    ...params
});

const checkFile = async params => post(`/file/check`,{
    ...params
});

const checkApi = async params => get(`/`,{
    ...params
});

export {
    merge_chunk,
    checkFile,
    checkApi
}