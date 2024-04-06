import { Config, Data } from "../../components/index.js"
import _ from "lodash"
import { si } from "./index.js"
import { initDependence } from "./DependencyChecker.js"
import { addData, getFileSize } from "./utils.js"

export default new class monitor {
  constructor() {
    // 网络
    this._network = null
    // 读写速率
    this._fsStats = null
    // 记录60条数据一分钟记录一次
    this.chartData = {
      network: {
        // 上行
        upload: [],
        // 下行
        download: []
      },
      fsStats: {
        // 读
        readSpeed: [],
        // 写
        writeSpeed: []
      },
      // cpu
      cpu: [],
      // 内存
      ram: [],
      // 主题
      echarts_theme: Data.readJSON("resources/state/theme_westeros.json"),
      backdrop: Config.state.backdrop
    }
    this.valueObject = {
      networkStats: "rx_sec,tx_sec,iface",
      currentLoad: "currentLoad",
      mem: "active",
      fsStats: "wx_sec,rx_sec"
    }

    this.init()
  }

  set network(value) {
    if (_.isNumber(value[0]?.tx_sec) && _.isNumber(value[0]?.rx_sec)) {
      this._network = value
      addData(this.chartData.network.upload, [ Date.now(), value[0].tx_sec ])
      addData(this.chartData.network.download, [ Date.now(), value[0].rx_sec ])
    }
  }

  get network() {
    return this._network
  }

  set fsStats(value) {
    if (_.isNumber(value?.wx_sec) && _.isNumber(value?.rx_sec)) {
      this._fsStats = value
      addData(this.chartData.fsStats.writeSpeed, [ Date.now(), value.wx_sec ])
      addData(this.chartData.fsStats.readSpeed, [ Date.now(), value.rx_sec ])
    }
  }

  get fsStats() {
    return this._fsStats
  }

  async init() {
    if (!await initDependence()) return

    // 给有问题的用户关闭定时器
    if (!Config.state.statusTask) return

    if (Config.state.statusPowerShellStart) si.powerShellStart()
    this.getData()
    // 网速
    const Timer = setInterval(async() => {
      let data = await this.getData()
      if (_.isEmpty(data)) clearInterval(Timer)
    }, 60000)
  }

  async getData() {
    let data = await si.get(this.valueObject)
    _.forIn(data, (value, key) => {
      if (_.isEmpty(value)) {
        logger.debug(`获取${key}数据失败，停止获取对应数据`)
        delete this.valueObject[key]
      }
    })
    let {
      fsStats,
      networkStats,
      mem: { active },
      currentLoad: { currentLoad }
    } = data
    this.fsStats = fsStats
    this.network = networkStats
    if (_.isNumber(active)) {
      addData(this.chartData.ram, [ Date.now(), active ])
    }
    if (_.isNumber(currentLoad)) {
      addData(this.chartData.cpu, [ Date.now(), currentLoad ])
    }
    return data
  }

  // 获取读取速率
  get DiskSpeed() {
    if (!this.fsStats ||
      this.fsStats.rx_sec == null ||
      this.fsStats.wx_sec == null
    ) {
      return false
    }
    return {
      rx_sec: getFileSize(this.fsStats.rx_sec, false, false),
      wx_sec: getFileSize(this.fsStats.wx_sec, false, false)
    }
  }

  /**
   *  获取网速
   * @returns {object}
   */
  get getNetwork() {
    let network = _.cloneDeep(this.network)?.[0]
    if (!network || network.rx_sec == null || network.tx_sec == null) {
      return false
    }
    network.rx_sec = getFileSize(network.rx_sec, false, false)
    network.tx_sec = getFileSize(network.tx_sec, false, false)
    // return network
    return {
      first: network.iface,
      tail: `↑${network.tx_sec}/s | ↓${network.rx_sec}/s`
    }
  }
}()
