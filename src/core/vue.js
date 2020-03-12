import Observer from './Observer'
import Watcher from './Watcher'

// 指令处理对象
const Instructions = {
  model (vm, node, expr) {
    // input => vm.$data
    node.addEventListener('input', (event) => {
      vm.setData(expr, event.target.value)
    })
    // vm.$data => input
    node.value = vm.getData(expr)
  },
  on (vm, node, eventType, handler) {
    // handler绑定this，否则this指向event.target
    node.addEventListener(eventType, vm[handler].bind(vm))
  },
  bind (vm, node, prop, expr) {
    switch (prop) {
      case 'style':
        new Watcher(vm, expr, (value) => {
          Object.assign(node.style, value)
        })
        Object.assign(node.style, vm.getData(expr))
        break
      case 'class':
        new Watcher(vm, expr, (list) => {
          node.classList = list.join(' ')
        })
        node.classList = vm.getData(expr).join(' ')
        break
      default:
        throw new Error('can\'t resolve the value ' + expr)
    }
  }
}

export default class Vue {
  // options就是data, methods, computed等
  constructor (options) {
    this.$el = document.querySelector(options.el)
    this.$data = options.data
    Observer(this.$data) // 监听数据
    Object.assign(this, options.methods) // 将方法挂载到this
    // 缓存dom节点
    const fragment = this.createFragment(this.$el)
    // 编译替换
    this.reg = new RegExp(/\{\{(.+?)\}\}/, 'g')
    this.compile(fragment)
    // 插入节点,显示出来
    this.$el.appendChild(fragment)
    // 将data代理到this上
    for (const key in this.$data) {
      Object.defineProperty(this, key, {
        configurable: true,
        enumerable: true,
        get () {
          console.log('代理读取')
          return this.$data[key]
        },
        set (newVal) {
          console.log('代理赋值')
          this.$data[key] = newVal
        }
      })
    }
  }
  compile (fragment) {
    // 将类数组结构展开遍历
    [...fragment.childNodes].forEach((node) => {
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
    [...node.attributes].forEach((attr) => {
      // expr主要用来确定是哪个值
      const { name, value: expr } = attr
      // 判断是不是指令:v-bind,v-model,v-on
      if (name.startsWith('@') || name.startsWith(':') || name.startsWith('v-')) {
        // 策略模式封装不同的算法
        this.compileInstruction(node, name, expr)
        // 自定义节点编译完就删除
        node.removeAttribute(name)
      }
    })
  }
  compileInstruction (node, name, expr) {
    const reg = new RegExp(/v-(.+?)\:/)
    if (reg.test(name)) {
      // v-on:click
      const [, type] = name.match(reg) // 获取正则括号中的匹配内容
      const prop = name.substr(name.indexOf(':') + 1) // 获取事件名，例如click
      Instructions[type](this, node, prop, expr)
    } else if (name.startsWith('v-')) {
      const [, type] = name.split('-')
      Instructions[type](this, node, expr)
    } else {
      const [type, ...prop] = name
      if (type === '@') {
        Instructions.on(this, node, prop.join(''), expr)
      } else if (type === ':') {
        Instructions.bind(this, node, prop.join(''), expr)
      }
    }
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
  getContentValue (originText) {
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
  setData (expr, value) {
    expr.split('.').reduce((data, current, index, arr) => {
      if (index === arr.length - 1) {
        return data[current] = value
      }
      return data[current]
    }, this.$data)
  }
  createFragment (node) {
    const fragment = document.createDocumentFragment()
    while (node.firstChild) {
      // 插入碎片相当于从页面中抽离
      fragment.appendChild(node.firstChild)
    }
    return fragment
  }
}
