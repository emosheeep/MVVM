import Dep from "./Dep"
export default class Observer {
    constructor (data) {
        this.observe(data)
        const handler = {
            get (target, key) {
                let dep = new Dep() // 为每一个属性都添加一个订阅
                Dep.target && dep.add(Dep.target)
                return Reflect.get(target, key)
            },
            set (target, key, value) {
                if(target[key] !== value){
                    dep.notify() // 通知订阅者更新
                }
               return Reflect.set(target, key, value)
            }
        }
        return new Proxy(data, handler)
    }
    observe (data) {
        if(Object.prototype.toString.call(data) === '[object Object]') {
            // 遍历 data 对象属性，调用 defineReactive 方法
            for(let key in data) {
                this.defineReactive(data, key, data[key])
            }
        }
    }
    // defineReactive方法仅仅将data的属性转换为访问器属性
    defineReactive (data, key, val) {
        // 递归观测子属性
        this.observe(val)
        let dep = new Dep() // 为每一个属性都添加一个订阅
        Object.defineProperty(data, key, {
            enumerable: true,
            configurable: true,
            get () {
                Dep.target && dep.add(Dep.target)
                return val
            },
            set: newVal => {
                // 和旧的值比对
                //　TODO：可以实现深层对比
                console.log('新', newVal)
                if(val !== newVal){
                    this.observe(newVal)  // 对新值进行观测
                    val = newVal
                    dep.notify() // 通知订阅者更新
                }
            }
        })
    }
}
