import Dep from "./Dep"
/**
 * watcher
 * @param {*} vm 当前实例
 * @param {*} exp 表达式
 * @param {*} fn 监听函数
 */
export default class Watcher {
    constructor (vm, exp, fn) {
        this.callback = fn
        this.data = vm.$data
        this.exp = exp // 类似于data.name的字符串
        // 添加订阅
        Dep.target = this
        // 触发getter
        this.fire()
        Dep.target = null // 防止watcher重复添加
    }
    // 这里是为了触发Observer中定义的getter属性，执行dep.add(Dep.target)
    // 从而将watcher与Observer联系起来
    fire () {
        // 之所以这样获取数据是为了让多层属性也能获取到
        return this.exp.split('.').reduce((result, key) =>{
            return result[key]
        }, this.data)
    }
    update () {
        let val = this.fire()
        this.callback(val)
    }
}
