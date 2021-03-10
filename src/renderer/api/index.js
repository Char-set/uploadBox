import {get, post, postForm} from '../utils/Http'

const merge_chunk = async params => post(`/file/merge_chunk`);

export {
    merge_chunk
}