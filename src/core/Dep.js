/**
 * 依赖收集，用来关联watcher和observer
 */
export default class Dep {
  constructor () {
    this.watchers = []
  }
  add (sub) {
    this.watchers.push(sub)
  }
  notify () {
    this.watchers.forEach(watcher => watcher.update())
  }
}
