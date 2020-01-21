# MVVM框架实现原理
[【掘金】MVVM框架响应式原理解析+实现](https://juejin.im/post/5e255e7df265da3dee21fc5d)

# 运行
```
// 构建项目并运行到8080端口
npm run dev
```

# 框架实现
> vue.js 是采用数据劫持结合发布/订阅模式，通过Object.defineProperty()劫持各个属性的setter，getter，在数据变动时发布消息给订阅者，触发相应的监听函数

框架实现主要包括以下三方面内容：
1. 数据劫持（代理）
2. 发布/订阅
3. 模板编译

前两点实现响应式，第三点解析自定义dom结构，解析自定义指令，添加订阅实现响应等，具体提到了再说。

# 数据代理/劫持
笔者目前了解到的监听对象属性的方法大都依赖于其一：
1. Object.defineProperty()定义访问器属性（访问器属性不能直接定义）
2. Proxy对象实现代理

本文采用第一种方法，关于Proxy和Object.defineProperty的优劣区别对比，感兴趣的可以自行了解，这里不做过多展开。如果你还不了解上述方法，建议先收藏本文，然后等弄懂它们之后再来看，否则文章可能不太友好==。

## Observer类
首先我们创建一个Observer类用来为数据定义访问器属性。主要功能是为传入对象的每个属性定义访问器属性，这是实现响应式的第一步。

```
class Observer {
    constructor (data) {
        this.observe(data)
    }
    // 观测对象
    observe (data) {
        // 注重原理，这里目的是判定数据是否为对象，更精确的还有Object.prototype.toString.call()
        if(typeof data === 'object') {
            // 遍历 data 对象属性，调用 defineReactive 方法
            for(let key in data) {
                this.defineReactive(data, key, data[key])
            }
        }
    }
    // defineReactive方法仅仅是将data的属性转换为访问器属性
    defineReactive (data, key, val) {
        // 递归观测子属性
        this.observe(val)
        // *****   重点    *****
        // 为每一个属性都添加一个订阅
        // 这里参且记住，下面讲到Dep类的时候会详细阐述
        let dep = new Dep() 
        // 定义访问器属性，响应式基础
        Object.defineProperty(data, key, {
            enumerable: true,
            configurable: true,
            get () {
                // 这里暂且记住，下面讲到Dep类的时候会详细阐述
                // 添加订阅者（Watcher），通过Dep.target获取
                // 闭包的缘故，这里的每一个dep实例都是独一无二的，都会被存储用来监听对应的属性
                Dep.target && dep.add(Dep.target)
                return val 
                // 这里getter的返回值就是读取属性时获取到的值
                // 为什么这里没有return data[key] ？
                // 因为data[key]是读取操作，会再次触发getter属性，造成死循环，最终使得堆栈溢出
                // 这其实和Proxy对象代理对象需要有一个target一样，总不能自己代理自己呀
            },
            set: newVal => {
                // 和旧的值比对
                // val是调用函数时传进来的对应属性的原始值
                // 由于闭包，每个值都停留在内存中且互不影响
                // newVal 是赋值操作时等号右边的值
                if(val !== newVal){
                    // 对新值进行观测，同样是为了实现响应式
                    this.observe(newVal)
                    // 更新闭包中的值否则get属性返回的值还是原始值
                    val = newVal
                    // 当数据改变后通知所有Watcher，执行回调函数实现对应的功能
                    // 所以最后的结果就是，每一个属性都由自己的一个dep对象监听着
                    // 这点很重要，因为在后面的框架中会添加很多的Watcher到dep对象中
                    // 同一个属性在页面多处使用到了，那么每一处都有一个Watcher订阅
                    // 数据改变后，dep通知所有Watcher
                    // 订阅了该属性的所有Watcher将新数据渲染到页面完成刷新
                    dep.notify() // 通知订阅者更新
                }
            }
        })
    }
}
```
由于语言层面的限制，我们只能监听到data对象的常规属性。而对象不同于常规类型，属于引用类型的数据，保存在堆内存中，它的比较更为复杂，无法直接利用等号完成，这也就是为什么Vue中如果修改对象某一个属性时可能会出现没有响应到的情况，这时就需要使用Vue.set()函数强制更新，或者使用整体替换的方式，新建一个对象覆盖原对象。

# 事件的发布/订阅
到这里，我们实现了Observer类，访问器属性准备就绪.但是光有基础还不够，我们还差一些调度——**Dep类和Watcher类。**

Dep是Dependency的缩写，意为依赖，是用来收集依赖并将访问器属性与Watcher连接起来的桥梁
