import _ from "lodash"
import moment from "moment"
import loader from "../../../lib/plugins/loader.js"
import { Config } from "../components/index.js"
import { QQApi } from "./index.js"
import { Time_unit, ROLE_MAP } from "../constants/other.js"
import formatDuration from "../tools/formatDuration.js"

// 无管理文案
const ROLE_ERROR = "❎ 该命令需要管理员权限"

export default class {
  constructor(e) {
    this.e = e
    this.Bot = e.bot ?? Bot
    this.MuteTaskKey = "yenai:MuteTasks"
  }

  /**
   * 获取指定群中所有成员的信息映射表
   * @param {number} groupId - 群号码
   * @param {boolean} [iskey] - 是否只返回成员 QQ 号码列表（键）
   * @returns {Promise<Array>} - 成员信息数组，或成员 QQ 号码数组（取决于 iskey 参数）
   */
  async _getMemberMap(groupId, iskey = false) {
    let Map = await this.Bot.pickGroup(groupId - 0).getMemberMap(true)
    return Array.from(iskey ? Map.keys() : Map.values())
  }

  /**
   * 获取某个群组中被禁言的成员列表。
   * @async
   * @param {number} groupId - 群组 ID。
   * @param {boolean} [info] - 是否返回成员信息。
   * @returns {Promise<Array<object> | Array<Array<string>>>} 如果 `info` 为 `false`，返回被禁言成员对象的数组；否则，返回被禁言成员信息的数组。
   * @throws {Error} 如果没有被禁言的成员，抛出异常。
   */
  async getMuteList(groupId, info = false) {
    let list = await this._getMemberMap(groupId)
    let mutelist = list.filter(item => {
      let time = item.shut_up_timestamp ?? item.shutup_time
      return time != 0 && (time - (Date.now() / 1000)) > 0
    })
    if (_.isEmpty(mutelist)) throw new ReplyError("❎ 该群没有被禁言的人")
    if (!info) return mutelist
    return mutelist.map(item => {
      let time = item.shut_up_timestamp ?? item.shutup_time
      return [
        segment.image(`https://q1.qlogo.cn/g?b=qq&s=100&nk=${item.user_id}`),
        `\n昵称：${item.card || item.nickname}\n`,
        `QQ：${item.user_id}\n`,
        `群身份：${ROLE_MAP[item.role]}\n`,
        `禁言剩余时间：${formatDuration(time - Date.now() / 1000, "default")}\n`,
        `禁言到期时间：${new Date(time * 1000).toLocaleString()}`
      ]
    })
  }

  /**
   * 解除指定群中所有成员的禁言状态
   * @returns {Promise<void>} - 由所有解禁操作的 Promise 对象组成的数组
   */
  async releaseAllMute() {
    let mutelist = await this.getMuteList(this.e.group_id)
    for (let i of mutelist) {
      this.e.group.muteMember(i.user_id, 0)
    }
  }

  /**
   * 获取指定时间段内未活跃的群成员信息
   * @async
   * @param {number} groupId - 群号码
   * @param {number} times - 时间数值
   * @param {string} unit - 时间单位
   * @param {number} [page] - 需要获取的页码，默认为 1
   * @returns {Promise<Array<Array>>} - 由每个成员的信息组成的数组，包括成员的 QQ 号码、昵称、最后发言时间等信息
   * @throws {Error} 如果没有符合条件的成员，将抛出一个错误
   * @throws {Error} 如果指定的页码不存在，将抛出一个错误
   */
  async getNoactiveInfo(groupId, times, unit, page = 1) {
    let list = await this.noactiveList(groupId, times, unit)
    list.sort((a, b) => a.last_sent_time - b.last_sent_time)
    let msg = list.map(item =>
      [
        segment.image(`https://q1.qlogo.cn/g?b=qq&s=100&nk=${item.user_id}`),
        `\nQQ：${item.user_id}\n`,
        `昵称：${item.card || item.nickname}\n`,
        `最后发言时间：${moment(item.last_sent_time * 1000).format("YYYY-MM-DD HH:mm:ss")}`
      ]
    )
    let pageChunk = _.chunk(msg, 30)
    if (page > pageChunk.length) throw new ReplyError("❎ 页数超过最大值")

    let msgs = pageChunk[page - 1]
    msgs.unshift(`当前为第${page}页，共${pageChunk.length}页，本页共${msgs.length}人，总共${msg.length}人`)
    msgs.unshift(`以下为${times}${unit}没发言过的人`)
    if (page < pageChunk.length) {
      msgs.splice(2, 0, `可用 "#查看${times}${unit}没发言过的人第${page + 1}页" 翻页`)
    }
    return msgs
  }

  /**
   * 清理多久没发言的人
   * @param {number} groupId 群号
   * @param {number} times 时间数
   * @param {string} unit 单位 (天)
   * @returns {Promise<boolean>}
   * @throws {Error} 如果没有符合条件的成员，将抛出一个错误
   */
  async clearNoactive(groupId, times, unit) {
    let list = await this.noactiveList(groupId, times, unit)
    list = list.map(item => item.user_id)
    return this.BatchKickMember(groupId, list)
  }

  /**
   * 返回多少时间没发言的人列表
   * @param {number} groupId 群号
   * @param {number} times 时间数
   * @param {string} unit 单位 (天)
   * @returns {Promise<number[]>}
   * @throws {Error} 如果没有符合条件的成员，将抛出一个错误
   */
  async noactiveList(groupId, times = 1, unit = "月") {
    let nowtime = parseInt(Date.now() / 1000)
    let timeUnit = Time_unit[unit]

    let time = nowtime - times * timeUnit
    let list = await this._getMemberMap(groupId)

    list = list.filter(item => item.last_sent_time < time && item.role == "member" && item.user_id != this.Bot.uin)
    if (_.isEmpty(list)) throw new ReplyError(`✅ 暂时没有${times}${unit}没发言的人`)
    return list
  }

  /**
   * 返回从未发言的人
   * @param {number} groupId 群号
   * @returns {Promise<number[]>}
   * @throws {Error} 如果没有符合条件的成员，将抛出一个错误
   */
  async getNeverSpeak(groupId) {
    let list = await this._getMemberMap(groupId)
    list = list.filter(item =>
      item.join_time == item.last_sent_time &&
      item.role == "member" &&
      item.user_id != this.Bot.uin
    )
    if (_.isEmpty(list)) throw new ReplyError("✅ 本群暂无从未发言的人")
    return list
  }

  /**
   * 获取群内从未发言的成员信息
   * @async
   * @param {string|number} groupId - 群号
   * @param {number} [page] - 分页页码，默认为第一页
   * @returns {Promise<Array<string>>} 包含从未发言成员信息的数组
   * @throws {Error} 如果没有符合条件的成员，将抛出一个错误
   * @throws {Error} 当页码超出范围时抛出错误
   */
  async getNeverSpeakInfo(groupId, page = 1) {
    let list = await this.getNeverSpeak(groupId)
    list.sort((a, b) => a.join_time - b.join_time)
    let msg = list.map(item => {
      return [
        segment.image(`https://q1.qlogo.cn/g?b=qq&s=100&nk=${item.user_id}`),
        `\nQQ：${item.user_id}\n`,
        `昵称：${item.card || item.nickname}\n`,
        `进群时间：${moment(item.join_time * 1000).format("YYYY-MM-DD HH:mm:ss")}`
      ]
    })
    let pageChunk = _.chunk(msg, 30)
    if (page > pageChunk.length) throw new ReplyError("哪有那么多人辣o(´^｀)o")

    let msgs = pageChunk[page - 1]
    msgs.unshift(`当前为第${page}页，共${pageChunk.length}页，本页共${msgs.length}人，总共${msg.length}人`)
    msgs.unshift("以下为进群后从未发言过的人")
    if (page < pageChunk.length) {
      msgs.splice(2, 0, `可用 "#查看从未发言过的人第${page + 1}页" 翻页`)
    }
    return msgs
  }

  /**
   * 批量踢出群成员
   * @param {number} groupId - 群号码
   * @param {Array<number>} arr - 成员 QQ 号码数组
   * @returns {Promise<Array<string>>} - 包含清理结果的数组，其中清理结果可能是成功的踢出列表，也可能是错误消息
   */
  async BatchKickMember(groupId, arr) {
    let res = await new QQApi(this.e).deleteGroupMember(groupId, arr)
    let msg = [ "以下为每次清理的结果" ]
    res.forEach(i => {
      if (i.ec != 0) {
        msg.push(`错误：${JSON.stringify(res)}`)
      } else {
        msg.push("成功清理如下人员\n" + i.ul.map((item, index) =>
      `${index + 1}、${item}`
        ).join("\n"))
      }
    })
    return msg
  }

  /**
   * 获取群不活跃排行榜
   * @param {number} groupId - 群号码
   * @param {number} num - 需要获取的排行榜长度
   * @returns {Promise<Array<Array>>} - 由每个成员的排行信息组成的数组，排行信息包括成员的排名，QQ 号码，昵称，最后发言时间等信息
   */
  async InactiveRanking(groupId, num) {
    let list = await this._getMemberMap(groupId)
    list.sort((a, b) => {
      return a.last_sent_time - b.last_sent_time
    })
    let msg = list.slice(0, num)
    msg = msg.map((item, index) => {
      return [
`第${index + 1}名：\n`,
segment.image(`https://q1.qlogo.cn/g?b=qq&s=100&nk=${item.user_id}`),
      `\nQQ：${item.user_id}\n`,
      `昵称：${item.card || item.nickname}\n`,
      `最后发言时间：${moment(item.last_sent_time * 1000).format("YYYY-MM-DD HH:mm:ss")}`
      ]
    })
    msg.unshift(`不活跃排行榜top1 - top${num}`)
    return msg
  }

  /**
   * 获取最近加入群聊的成员列表
   * @param {number} groupId 群号
   * @param {number} num 返回的成员数量
   * @returns {Promise<string[][]>} 最近加入的成员信息列表
   */
  async getRecentlyJoined(groupId, num) {
    let list = await this._getMemberMap(groupId)
    list.sort((a, b) => {
      return b.join_time - a.join_time
    })
    let msg = list.slice(0, num)
    msg = msg.map((item) => {
      return [
        segment.image(`https://q1.qlogo.cn/g?b=qq&s=100&nk=${item.user_id}`),
        `\nQQ：${item.user_id}\n`,
        `昵称：${item.card || item.nickname}\n`,
        `入群时间：${moment(item.join_time * 1000).format("YYYY-MM-DD HH:mm:ss")}\n`,
        `最后发言时间：${moment(item.last_sent_time * 1000).format("YYYY-MM-DD HH:mm:ss")}`
      ]
    })
    msg.unshift(`最近的${num}条入群记录`)
    return msg
  }

  /**
   * @description 设置指定群的禁言/解禁定时任务
   * @param {string} group - 群号
   * @param {string} cron - 定时任务执行时间的 Cron 表达式
   * @param {boolean} type - 是否为禁言任务。如果为 true，则表示禁言任务；否则，表示解禁任务。
   * @returns {Promise<boolean>} - 返回操作结果。如果设置成功，则返回 true；否则，返回 false。
   */
  async setMuteTask(group, cron, type) {
    let name = `椰奶群定时${type ? "禁言" : "解禁"}${group}`
    if (loader.task.find(item => item.name == name)) return false
    let redisTask = JSON.parse(await redis.get(this.MuteTaskKey)) || []
    let task = {
      cron,
      name,
      fnc: () => {
        this.Bot.pickGroup(group).muteAll(type)
      }
    }
    loader.task.push(_.cloneDeep(task))
    loader.creatTask()
    redisTask.push({ cron, group, type, botId: this.Bot.uin })
    redis.set(this.MuteTaskKey, JSON.stringify(redisTask))
    return true
  }

  /**
   * @description 从 Redis 中获取群禁言/解禁任务列表，并将其转换为定时任务列表
   * @returns {Promise<Array>} - 返回转换后的定时任务列表，列表中的每一项都包含 cron、name 和 fnc 三个属性。其中，cron 表示任务的执行时间；name 表示任务的名称；fnc 表示任务的执行函数。
   */
  static async getRedisMuteTask() {
    return JSON.parse(await redis.get("yenai:MuteTasks"))?.map(item => {
      return {
        cron: item.cron,
        name: `椰奶群定时${item.type ? "禁言" : "解禁"}${item.group}`,
        fnc: () => {
          (Bot[item.botId] ?? Bot).pickGroup(item.group).muteAll(item.type)
        }
      }
    })
  }

  /**
   * @description 删除指定的群禁言/解禁任务
   * @param {string} group - 群号
   * @param {boolean} type - 是否为禁言任务。如果为 true，则表示禁言任务；否则，表示解禁任务。
   * @returns {Promise<boolean>} - 返回操作结果。如果删除成功，则返回 true。
   */
  async delMuteTask(group, type) {
    let redisTask = JSON.parse(await redis.get(this.MuteTaskKey)) || []
    loader.task = loader.task.filter(item => item.name !== `椰奶群定时${type ? "禁言" : "解禁"}${group}`)
    redisTask = redisTask.filter(item => item.group !== group && item.type !== type)
    redis.set(this.MuteTaskKey, JSON.stringify(redisTask))
    return true
  }

  /** 获取定时任务 */
  getMuteTask() {
    let RegEx = /椰奶群定时(禁言|解禁)(\d+)/
    let taskList = _.cloneDeep(loader.task)
    let MuteList = taskList.filter(item => /椰奶群定时禁言\d+/.test(item.name))
    let noMuteList = taskList.filter(item => /椰奶群定时解禁\d+/.test(item.name))
    noMuteList.forEach(noitem => {
      let index = MuteList.findIndex(item => noitem.name.match(RegEx)[2] == item.name.match(RegEx)[2])
      if (index !== -1) {
        MuteList[index].nocron = noitem.cron
      } else {
        noitem.nocron = noitem.cron
        delete noitem.cron
        MuteList.push(noitem)
      }
    })
    return MuteList.map(item => {
      let analysis = item.name.match(RegEx)
      return [
        segment.image(`https://p.qlogo.cn/gh/${analysis[2]}/${analysis[2]}/100`),
        `\n群号：${analysis[2]}`,
        item.cron ? `\n禁言时间："${item.cron}"` : "",
        item.nocron ? `\n解禁时间："${item.nocron}"` : ""
      ]
    })
  }

  /**
   * @async
   * @function muteMember
   * @description 将群成员禁言
   * @param {string|number} groupId - 群号
   * @param {string|number} userId - QQ 号
   * @param {string|number} executor - 执行操作的管理员 QQ 号
   * @param {number} [time] - 禁言时长，默认为 5。如果传入 0 则表示解除禁言。
   * @param {string} [unit] - 禁言时长单位，默认为分钟
   * @returns {Promise<string>} - 返回操作结果
   * @throws {Error} - 如果缺少必要参数或参数格式不正确，则会抛出错误
   */
  async muteMember(groupId, userId, executor, time = 300, unit = "秒") {
    let _unit = Time_unit[unit.toUpperCase()] ?? (/^\d+$/.test(unit) ? unit : 60)
    const group = this.Bot.pickGroup(groupId, true)
    // 判断是否有管理
    if (!group.is_admin && !group.is_owner) throw new ReplyError(ROLE_ERROR)
    if (!(/\d{5,}/.test(userId))) throw new ReplyError("❎ 请输入正确的QQ号")

    // 判断是否为主人
    if ((Config.masterQQ?.includes(Number(userId) || String(userId))) && time !== 0) throw new ReplyError("❎ 该命令对主人无效")

    const Member = group.pickMember(userId)
    const Memberinfo = Member?.info || await Member?.getInfo?.()
    // 判断是否有这个人
    if (!Memberinfo) throw new ReplyError("❎ 该群没有这个人")

    // 特殊处理
    if (Memberinfo.role === "owner") throw new ReplyError("❎ 权限不足，该命令对群主无效")

    const isMaster = Config.masterQQ?.includes(executor)

    if (Memberinfo.role === "admin") {
      if (!group.is_owner) throw new ReplyError("❎ 权限不足，需要群主权限")
      if (!isMaster) throw new ReplyError("❎ 只有主人才能对管理执行该命令")
    }

    const isWhite = Config.groupAdmin.whiteQQ.includes(Number(userId) || String(userId))

    if (isWhite && !isMaster && time != 0) throw new ReplyError("❎ 该用户为白名单，不可操作")

    await group.muteMember(userId, time * _unit)
    const memberName = Memberinfo.card || Memberinfo.nickname
    return time == 0 ? `✅ 已将「${memberName}」解除禁言` : `✅ 已将「${memberName}」禁言${time + unit}`
  }

  /**
   * 踢群成员
   * @param {number} groupId 群号
   * @param {number} userId 被踢人
   * @param {number} executor 执行人
   * @returns {Promise<string>}
   */
  async kickMember(groupId, userId, executor) {
    const group = this.Bot.pickGroup(groupId, true)

    if (!userId || !(/^\d+$/.test(userId))) throw new ReplyError("❎ 请输入正确的QQ号")
    if (!groupId || !(/^\d+$/.test(groupId))) throw new ReplyError("❎ 请输入正确的群号")

    // 判断是否为主人
    if (Config.masterQQ?.includes(Number(userId) || String(userId))) throw new ReplyError("❎ 该命令对主人无效")

    const Member = group.pickMember(userId)
    const Memberinfo = Member?.info || await Member?.getInfo?.()
    // 判断是否有这个人
    if (!Memberinfo) throw new ReplyError("❎ 这个群没有这个人哦~")
    if (Memberinfo.role === "owner") throw new ReplyError("❎ 权限不足，该命令对群主无效")

    const isMaster = Config.masterQQ?.includes(executor)

    if (Memberinfo.role === "admin") {
      if (!group.is_owner) throw new ReplyError("❎ 权限不足，需要群主权限")
      if (!isMaster) throw new ReplyError("❎ 只有主人才能对管理执行该命令")
    }

    const isWhite = Config.groupAdmin.whiteQQ.includes(Number(userId) || String(userId))

    if (isWhite && !isMaster) throw new ReplyError("❎ 该用户为白名单，不可操作")

    const res = await group.kickMember(userId)
    if (!res) throw new ReplyError("❎ 踢出失败")
    return `✅ 已将「${userId}」踢出群聊`
  }
}
