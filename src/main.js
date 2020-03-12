import Vue from './core/vue'

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
    },
	nums: [1,2,3]
  },
  methods: {
    onClick (e) {
      this.style = {
        color: 'red',
        fontSize: '30px'
      }
	  this.nums.push(1)
    },
    sayHello (e) {
      console.log('你好，我叫', this.name)
    }
  }
})
