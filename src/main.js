import Vue from "./utils/vue"

window.vm = new Vue({
    el: '#app',
    data: {
        name: '小明',
        address: {
            province: '陕西省',
            city: '汉中市'
        }
    }
})
