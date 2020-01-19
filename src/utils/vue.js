/**
 * 依赖收集，用来关联watcher和observer
 */
class Dep {
    static target = null
    constructor () {
        this.subs = []
    }
    add (sub) {
        this.subs.push(sub)
    }
    notify () {
        this.subs.forEach(sub => sub.update())
    }
}

/**
 * watcher
 * @param {*} vm 当前实例
 * @param {*} exp 表达式
 * @param {*} fn 监听函数
 */
class Watcher {
    constructor (vm, exp, fn) {
        this.callback = fn
        this.data = vm.$data
        this.exp = exp // 类似于data.name的字符串
        // 添加到订约中
        Dep.target = this
        this.fire()
        Dep.target = null // 防止watcher重复添加
    }
    // 这里是为了触发Observer中定义的get函数，执行dep.add(Dep.target)
    // 从而将watcher与Observer联系起来
    fire () {
        return this.exp.split('.').reduce((result, key) =>{
            return result[key]
        }, this.data)
    }
    update () {
        let val = this.fire()
        this.callback(val)
    }
}
class Observer {
    constructor (data) {
        this.observe(data)
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
                if(val !== newVal){
                    this.observe(newVal)  // 对新值进行观测
                    val = newVal
                    dep.notify() // 通知订阅者更新
                }
            }
        })
    }
}

export default class Vue {
    // options就是data, methods, computed等
    constructor(options) {
        this.$el =  document.querySelector(options.el)
        this.$data = options.data
        new Observer(this.$data)
        this.reg = new RegExp(/\{\{(.+?)\}\}/, 'g')
        // 缓存dom节点
        let fragment = this.createFragment(this.$el)
        // 编译替换
        this.compile(fragment)
        // 插入节点,显示出来
        this.$el.appendChild(fragment)
        // 将data代理到this上
        for (let key in this.$data) {
            Object.defineProperty(this, key, {
                enumerable: true,
                get () {
                    console.log('代理成功')
                    return this.$data[key]
                },
                set (newVal) {
                    this.$data[key] = newVal
                }
            })
        }
    }
    compile (fragment) {
        // 将类数组结构展开遍历
        [...fragment.childNodes].forEach(node => {
            // 如果是元素节点则递归
            if (node.nodeType === 1) {
                this.compileElement(node)
                this.compile(node)
            } else {
                this.compileText(node)
            }
        })
    }
    compileElement (node) {
        [...node.attributes].forEach(attr => {
            // 属性值可以是表达式
            let {name, value: expr} = attr
            // 判断是不是指令:v-bind,v-model
            if (name.startsWith('v-')) {
                // 得到指令名
                let [, instruction] = name.split('-')
                // 策略模式封装不同的算法
                // TODO: 处理指令
            }
        })
    }
    compileText (node) {
        const nodeValue = node.nodeValue
        // 匹配 {{}}
        if (this.reg.test(nodeValue)) {
           this.updateText(node, nodeValue)
        }
    }
    updateText (node, originText) {
        node.nodeValue = originText.replace(this.reg, (match, content) => {
            new Watcher(this, content.trim(), () => {
                node.nodeValue = this.getContentValue(originText)
            })
            return this.getData(content.trim())
        })
    }
    getContentValue(originText) {
        return originText.replace(this.reg, (match, content) => {
            return this.getData(content.trim())
        })
    }
    // 根据表达式拿到对应的数据
    getData (expr) {
        // 一层层的解析,获取到最终数据
        return expr.split('.').reduce((data, key) => {
            return data[key]
        }, this.$data)
    }
    createFragment (node) {
        let fragment = document.createDocumentFragment()
        do {
            // 插入碎片相当于从页面中抽离
            fragment.appendChild(node.firstChild)
        } while (node.firstChild)
        return fragment
    }
}
