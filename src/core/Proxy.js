/**
 * Vue3使用Proxy实现响应式
 */
export default function proxyObserve (target = {}) {
	// 不是对象或数组则直接返回
    if (Object.prototype.toString.call(target) !== '[object Object]' && !Array.isArray(target)) {
        return target
    }
	
    return new Proxy(target, {
		get (target, key, receiver) {			
			const result = Reflect.get(target, key, receiver)
			if (Reflect.ownKeys(target).includes(key)) {
				console.log('get', key) // 只监听对象，不监听原型
			}
			
			return proxyObserve(result) // 递归监听（惰性的）
		},
		set (target, key, value, receiver) {
			if (target[key] === value) {
				return true // 值没有变化则直接返回
			}
			console.log('set', key, value)
			return Reflect.set(target, key, value, receiver)
		},
		deleteProperty (target, key) {
			console.log('delete', key)
			return Reflect.deleteProperty(target, key)
		}
	})
}