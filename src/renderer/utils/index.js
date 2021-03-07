const sliceMax = 2 * 1024 * 1024;

const upMemberMax = 3;

const filesSlice = file => {
    debugger
    let fileSize = file.size;
    let count = Math.ceil(fileSize / sliceMax);
    let fileslice = [];
    let start = 0, end;
    for(let i = 0; i <= count; i++) {
        if(i == count) {
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
}





module.exports = {
    filesSlice
}