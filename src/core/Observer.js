import Dep from './Dep'
/**
 * 深度监听需要一次性递归，注意是一次性。
 * 无法监听删除和新增属性。
 * 无法监听原生数组
 */
// 定义访问器属性实现监听
function defineReactive(target, key, value) {
    observe(value) // 递归监听
	
	const dep = new Dep() // 为每一个属性都添加一个订阅
	
    // 监听数组
    if (Array.isArray(value)) {
		// 监听数组，需要重新定义原型
		const arrProto = Object.create(Array.prototype)
		const methods = ['push', 'pop', 'splice', 'shift', 'unshift']
		
		methods.forEach(method => {
		    arrProto[method] = function (...args) {
		        console.log('数组更新视图！')
				dep.notify() // 通知订阅者更新
		        Array.prototype[method].apply(this, args)
		    }
		})
		
        value.__proto__ = arrProto
    }
	
    Object.defineProperty(target, key, {
        get () {
            // 此处收集依赖
			Dep.target && dep.add(Dep.target)
            return value
        },
        set (newVal) {
            if (value !== newVal) {
                console.log('视图更新！')
                observe(newVal) // 新值也要监听
                value = newVal
				dep.notify() // 通知订阅者更新
            }
        }
    })
}

export default function observe (data) {
    if (Object.prototype.toString.call(data) === '[object Object]') {
        for (const key in data) {
            defineReactive(data, key, data[key])
        }
    }
}
