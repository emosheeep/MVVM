import Vue from "./utils/vue"

new Vue({
    el: '#app',
    data: {
        style: {
            color: 'green',
            fontSize: '10px'
        },
        myClass: ['red'],
        name: '小明',
        address: {
            province: '陕西省',
            city: '汉中市'
        }
    },
    methods: {
        onClick (e) {
            this.style = {
                color: 'red',
                fontSize: '30px'
            }
        },
        sayHello (e) {
            console.log('你好，我叫', this.name)
        }
    }
})

// let target = [1, 2, 3]
// target = new Proxy(target, {
//     get (target, key) {
//         console.log('get', key)
//         return Reflect.get(target, key)
//     },
//     set(target, key, value) {
//         console.log('set', key, value)
//         return Reflect.set(target, key, value)
//     }
// })
// target.pop()
