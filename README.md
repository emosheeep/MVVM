# MVVM框架实现原理
[【掘金】MVVM框架响应式原理解析+实现](https://juejin.im/editor/posts/5e255e7df265da3dee21fc5d)

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

Dep是Dependency的缩写，意为依赖，是用来收集依赖并将访问器属性与Watcher连接起来的桥梁。每当setter发现数据更新，就通知相应属性的dep实例通知名下所有watcher更新数据，这就是响应，也就是之前的```dep.notify()```

## Dep类
```
/**
 * 依赖收集，用来关联watcher和observer
 */
class Dep {
    constructor () {
        // 储存订阅者——Watcher实例
        this.watchers = []
    }
    add (sub) {
        this.watchers.push(sub)
    }
    notify () {
        // 遍历Watcher，更新数据，每个watcher都要有一个update方法，why？
        // 因为只有数据修改了才需要调用函数更新数据，也就是所谓的合适的时机
        // 如果创建Watcher时就立即调用了，会造成重复调用，没有意义。
        // 后面讲到模板编译的时候会继续提到
        this.watchers.forEach(watcher => watcher.update())
    }
}
```
Dep类很简单，存储Watcher，然后在适当的时机调用update()

## Watcher类
```
/**
 * watcher
 * @param {*} vm  当前实例
 * @param {*} expr 表达式，就是数据获取途径，例如：data.style.color，data.name
 * @param {*} fn  回调函数
 */
class Watcher {
    constructor (vm, expr, fn) {
        this.callback = fn
        this.vm = vm
        this.expr = exp // 类似于data.name的字符串
        // 添加到订阅中 ————********下面三行划重点*********————
        Dep.target = this
        this.fire()
        Dep.target = null // 防止watcher重复添加
    }
    // 这里是为了触发Observer中定义的getter属性，执行dep.add(Dep.target)
    // 从而将watcher与Observer联系起来，函数叫什么本身并不重要
    fire () {
        // 这里利用reduce，将属性路径一层层剥开
        // 不熟悉reduce函数的话建议去了解下这里不做展开了
        // 在触发getter时顺便获取expr对应的data中的值
        // 重要的是思路，掘友们可以自己改编
        return this.expr.split('.').reduce((result, key) =>{
            return result[key]
        }, this.vm.$data)
    }
    update () {
        // 这里获取最新值，调用回调函数并传入对应属性的最新值
        let val = this.fire()
        this.callback(val)
    }
}
```
接下来让我们把目光放到这三行上：

```
Dep.target = this
this.fire()
Dep.target = null
```
为什么？首先我们思考，我们给data的属性都设置了访问器，数据变化时可以执行相应的逻辑，为什么还需要再使用发布/订阅模式来包一层呢？

由于模块化的限制，我们无法将对应的回调函数传入data属性的getter和setter中，因为我们不知道在网页中究竟哪些地方会使用到data里面的内容，**不可能提前写好，只能动态添加**。

所以这里必然是需要第三方替我们存储逻辑，并且在适当的时机执行逻辑的。很明显第三方就是dep实例，适当的时机其实就是数据更新时，所以setter中才会有一句`dep.notify()`。好的，但是这个dep实例已经被写死了，已经被`defineReactive`函数收养了，成了该函数的私有变量，我们无法在外部获取到它，那搞个毛线啊，无法添加实例，就算能notify又能怎样（手动罢工）？

不慌，办法总比问题多。既然被写死了，那我们只有在defineReactive内部才能为dep实例添加订阅了。瞅了瞅，发现可以利用getter。这不就解决了？只要我访问data的对应属性，就能触发getter，而getter的作用域中可以访问到dep实例，一拍即合。没想到吧getter还能这么用。现在回顾这句:
```
Dep.target && dep.add(Dep.target)
```

有没有倍感亲切，结合上面的三行代码可以知道：

```
Dep.target = this   // 将当前实例添加到Dep.target
this.fire()         // 触发getter，将Dep.target添加到dep实例中
Dep.target = null   // 防止可能出现的意外，例如不小心添加了相同的Watcher
```
至此，响应式的原理就解释完毕了，下面开始实现框架。

# 模板编译
模板编译就是将框架中的自定义语法格式，指令等等内容转换成常规模式（自定义指令，语法等，浏览器并不认识）。

## Vue 类
这个类比较长，因为涉及的操作有点多，但我还是会详细的解释


```
class Vue {
    // options就是data, methods等常见配置
    constructor(options) {
        // 绑定根元素
        this.$el =  document.querySelector(options.el)
        this.$data = options.data
        // 用到了Observer为data设置访问器属性
        new Observer(this.$data)
        // 将方法挂载到this，接可以通过this直接调用
        Object.assign(this, options.methods)
        // 用来匹配{{}}双括号语法的正则表达式，多处用到，干脆绑定到this
        this.reg = new RegExp(/\{\{(.+?)\}\}/, 'g')
        // 缓存dom节点，为什么使用文档碎片，后面会提到
        let fragment = this.createFragment(this.$el)
        // 开始编译
        this.compile(fragment)
        // 将编译完的文本节点替换回去
        this.$el.appendChild(fragment)
        // 将data代理到this上，我们使用的时候大都是通过this直接调用
        for (let key in this.$data) {
            Object.defineProperty(this, key, {
                enumerable: true,
                get () {
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
            // 如果是元素节点则递归遍历
            if (node.nodeType === 1) {
                this.compileElement(node)
                this.compile(node)
            } else {
                // 除去元素节点，就是文本节点了
                this.compileText(node)
            }
        })
    }
    compileElement (node) {
        // 元素节点的编译主要是转换其属性，所以这里遍历属性
        [...node.attributes].forEach(attr => {
            // expr就是expression的简写，是表达式的意思
            // 这里name是属性名，value是属性值，就是我们需要编译替换的部分
            // 通过解构赋值给value重新命名为expr
            let {name, value: expr} = attr
            // 判断是不是指令:v-bind,v-model,v-on
            if (name.startsWith('@') || name.startsWith(':') || name.startsWith('v-')) {
                // 如果属性包含这些字符说明是自定义属性，需要编译
                // 否则是原生属性，跳过
                this.compileInstruction(node, name, expr)
                // 自定义节点编译完就删除
                node.removeAttribute(name)
            }
        })
    }
    /**
     * 编译自定义属性，指令等
     * @param node  dom节点
     * @param name  属性名
     * @param expr  表达式（属性值）
     */
    compileInstruction (node, name, expr) {
        // 用来匹配v-on:中的on（举例）
        let reg = new RegExp(/v-(.+?)\:/)
        if (reg.test(name)) {
            // 举例 v-on:click / v-bind:class
            // type就是on或bind
            let [, type] = name.match(reg) // 获取匹配内容
            // 获取事件名或属性名，例如click或class
            let prop = name.substr(name.indexOf(':') + 1) 
            // 调用策略模式封装的算法，相关代码在后面
            Instructions[type](this, node, prop, expr)
        } else if (name.startsWith('v-')) {
            // type为指令名
            let [, type] = name.split('-')
            Instructions[type](this, node, expr)
        } else {
            // prop是对应的事件类型或者属性
            let [type, ...prop] = name
            if (type === '@') {
                Instructions['on'](this, node, prop.join(''), expr)
            } else if (type === ':') {
                Instructions['bind'](this, node, prop.join(''), expr)
            }
        }
    }
    // 编译文本节点
    compileText (node) {
        // 获取文本节点值
        const nodeValue = node.nodeValue
        // 匹配 {{}}
        if (this.reg.test(nodeValue)) {
            // 匹配到双括号说明需要替换
            this.updateText(node, nodeValue)
        }
    }
    updateText (node, originText) {
        node.nodeValue = originText.replace(this.reg, (match, content) => {
            // 这里的content就是我们的表达式
            // 例如：我叫{{name}}，匹配的content就是'name'
            // 这个表达式用于getData函数获取数据，根据属性获取数据
            
            // 这里需要为匹配到双括号表达式的文本节点添加订阅
            // 利用箭头函数没有this的特性
            // Watcher被触发时依然可以访问到这里的上下文
            new Watcher(this, content.trim(), () => {
                // *******这里注意*******
                // this.getContentValue返回的就是最新值
                // 不直接调用this.updateText是为了防止重复添加订阅
                // 所以将一部分逻辑分离出来单独作为一个函数
                // 实际上getContentValue在编译的时候是不会调用的
                // 只有数据更新才会调用到
                node.nodeValue = this.getContentValue(originText)
            })
            // 根据表达式content获取到相应的值并替换
            return this.getData(content.trim())
        })
    }
    // 这里为什么多引入一个函数？可以看到这里的逻辑基本是一样的
    // 因为如果递归调用updateText的话，不仅会重复添加订阅
    // 还会导致originText的值改变，不再为原始双括号表达式 => 我叫{{name}}
    // 这样后面就无法匹配并更新这个表达式的值了
    // 只有拿到这个文本才能每次替换新的值进去
    // 如果递归调用，这个值就会变成例如：我叫小明
    // 再往后数据再改变时，正则表达式就匹配不到双括号无法替换了
    // 幸运的是，有了闭包，可能你都没意识到你使用了闭包，就这么解决了
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
    // 根据表达式设置data中对应的值
    setData (expr, value) {
        expr.split('.').reduce((data, current, index, arr) => {
            if (index === arr.length - 1) {
                return data[current] = value
            }
            return data[current]
        }, this.$data)
    }
    // 创建文档碎片
    createFragment (node) {
        let fragment = document.createDocumentFragment()
        do {
            // 插入碎片相当于从页面中remove
            fragment.appendChild(node.firstChild)
        } while (node.firstChild)
        return fragment
    }
}
```
## Instructions对象
封装了常见的指令：
```
// 指令处理对象
const Instructions = {
    // v-model 实现数据双向绑定
    model (vm, node, expr) {
        // input => vm.$data
        node.addEventListener('input', event => {
            vm.setData(expr, event.target.value)
        })
        // vm.$data => input
        node.value = vm.getData(expr)
    },
    // v-on / '@' 绑定事件
    on (vm, node, eventType, handler) {
        // handler绑定this，否则this指向event.target
        node.addEventListener(eventType, vm[handler].bind(vm))
    },
    // v-bind / ':' 绑定属性
    bind (vm, node, prop, expr) {
        switch (prop) {
            // v-bind:style
            case 'style':
                new Watcher(vm, expr, value => {
                    // 驼峰命名的CSS属性
                    Object.assign(node.style, value)
                })
                Object.assign(node.style, vm.getData(expr))
                break
            // v-bind:class
            case 'class':
                // 由于这里绑定的数组，能够编译出来，但响应方面可能没有做到
                // 这里就不做了，感兴趣的话可以自己研究下如何响应数组
                // 当然，直接用新的覆盖还是可以的
                new Watcher(vm, expr, list => {
                    node.classList = list.join(' ')
                })
                node.classList = vm.getData(expr).join(' ')
                break
            default:
                throw new Error('can\'t resolve the value ' + expr)
        }
    }
}
```
# 示例
先是DOM结构：
```
<style>
    .red {
        color: red
    }
</style>
<div id="app">
    <div class="header"
         :style="style"
         v-on:click="sayHello"
    >
        姓名：{{name}}
    </div>
    <div>
        <div>省份：{{address.province}}, 市区：{{address.city}}</div>
        <div :class="myClass">市区：{{address.city}}</div>
    </div>
    <div :class="myClass">我叫：{{name}}</div>
    <input type="text" id="input" v-model="name">
    <button @click="onClick">改变颜色</button>
</div>
```

![DOM](https://user-gold-cdn.xitu.io/2020/1/21/16fc3b4c7a6c2fdc?w=459&h=179&f=png&s=14959)
然后是Vue实例：

```
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
```
![动态示例](https://user-gold-cdn.xitu.io/2020/1/21/16fc3bdce7027633?w=444&h=222&f=gif&s=1214773)


# 一些问题
## 1. 为什么无法利用访问器属性一次性深度监听对象？
在使用Proxy的过程中，我发现了一个有趣的现象：在试图访问或修改目标对象的属性时，在对应的getter和seter中均只能获取到对象的**一级属性名**，下面通过一个例子说明为什么：
```
let target = {
    index: 3,
    style: {
        color: 'red',
        fontSize: '30px'
    }
}
// 代理对象
let proxy = new Proxy(target, {
    get (target, key) {
        console.log('get', key)
        return target[key]
    },
    set(target, key, value) {
        console.log('set', key, value)
        return target[key] = value
    }
})
// 试图修改style.color
proxy.style.color = 'green'     // 控制台 => get style (为啥是get不是set？)
console.log(proxy.style.color)  // 控制台 => get style => green
proxy.index = 1                 // 控制台 => set index 1
proxy.style = {                 // 控制台 => set style {color: "red"}
    color: 'red'
}
```

从上面的代码中可以看出，在属性为对象的情况下，无论是更改其属性还是读取其属性，均只能触发getter，并且get只能获取到**一级属性名**，也就是style，而不是style.color。

但根据第二行打印结果我们可以知道target.style.color确实被修改成了'green'，但setter属性也确实没有捕捉到赋值操作，代理层还以为你要访问呢，反而执行的是getter。只有第四行**赋值为新的对象**时，这才实现我们想要的效果。是不是很有趣？

通过这个例子，我想你应该明白为什么我们无法一劳永逸的深度监听对象了。

## 2. 这里所用到的Dep和Watcher和传统意义上的观察者模式，和发布订阅这模式有什么关系？傻傻分不清

![区别](https://user-gold-cdn.xitu.io/2020/1/21/16fc7262ebef1196?w=683&h=548&f=png&s=111894)

这个例子就很精辟：[发布订阅模式和观察者模式的区别](https://www.cnblogs.com/ckAng/p/11143888.html)

两种模式都可以用于松散耦合，改进代码管理和潜在的复用

## 3. 实现一个MVVM里面需要那些核心模块？各个核心模块之间的关系是怎样的？
1. 模型：就是数据
2. 视图：用户在屏幕上看到的结构、布局和外观（UI）。
3. 视图模型：连接视图和数据，将视图转化为数据或将数据转换为视图。如何转换？视图到数据需要通过dom事件监听，数据到视图需要观察者。视图模型层就负责调度这些流程。
![流程](https://user-gold-cdn.xitu.io/2020/1/21/16fc6f74d85269a2?w=500&h=100&f=jpeg&s=5164)
关系如下：
![关系](https://user-gold-cdn.xitu.io/2020/1/21/16fc6f9df987cb90?w=640&h=342&f=png&s=172558)
## 4. 为什么操作DOM要利用文档碎片(Fragment)？
大家都知道DOM操作很昂贵，非常消耗性能，但却不知道为什么。其实主要是因为会触发浏览器的**重绘(repaint)和重排(reflow)**。

重绘是部分元素样式改变，需要重新绘制；重排是元素位置、大小等发生改变，浏览器要重新计算渲染树。导致渲染树的一部分或全部发生变化。渲染树重新建立后，浏览器会重新绘制页面上受影响的元素。

这些操作操作需要大量计算才能完成，所以吃性能。但是如果用文档碎片的话，将DOM元素放进内存操作，这时候就只是操作对象了，和浏览器就没有关系了。如果说对性能的影响的话，就只能是最后插入文档中的时候了。同理，也可以将display设置为none，只要浏览器显示出来的界面没有变化就ok，但一般不会这样做。。。
## 5. Vue中如何对数组进行数据劫持？
这里我们可以使用Proxy实现：

```
let target = [1, 2, 3]
let proxy = new Proxy(target, {
    get (target, key) {
        console.log('get', key)
        return Reflect.get(target, key)
    },
    set(target, key, value) {
        console.log('set', key, value)
        return Reflect.set(target, key, value)
    }
})

proxy[1] = 9
proxy.pop()
proxy.push(0)
```
控制台打印结果如下：

![结果](https://user-gold-cdn.xitu.io/2020/1/21/16fc6971ba18aa21?w=118&h=182&f=png&s=4029)

实际上，由于Proxy只是在目标对象之前设了一层拦截，所以并不会污染原生Array


# 参考
1. [【掘金】手写一套完整的基于Vue的MVVM原理](https://juejin.im/post/5e1b3144f265da3e4b5be2e3)
2. [【其他】Vue2.1.7源码学习](http://hcysun.me/2017/03/03/Vue%E6%BA%90%E7%A0%81%E5%AD%A6%E4%B9%A0/)
3. [【掘金】50行代码的MVVM，感受闭包的艺术](https://juejin.im/post/5b1fa77451882513ea5cc2ca)
