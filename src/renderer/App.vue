<template>
<div id="app">
    <router-view></router-view>
</div>
</template>

<script>
export default {
    name: 'uploadbox'
}
</script>

<style>
/* CSS */
* {
    padding: 0;
    margin: 0;
    border: 0;
}

body {
    width: 100%;
    height: 100%;
    font-family: PingFang SC,PingFangSC-Regular, Helvetica, Arial, STXihei, SimSun, sans-serif;
    color: #302D26;
    font-size: 12px;
    background: #f4f4f4;
    -webkit-user-select: inherit;
    word-wrap: break-word;
    user-select: none;
}
</style>
