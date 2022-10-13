import plugin from '../../../lib/plugins/plugin.js'
import { segment } from "oicq";
import fetch from 'node-fetch'
import fs from 'fs'
import Config from '../model/Config.js';
//默认配置
let def = {
  r18: 0,
  recall: 30,
  cd: 300,
}
//存cd的变量
let temp = {};

let api = "https://api.lolicon.app/setu/v2";

export class sese extends plugin {
  constructor() {
    super({
      name: 'setu',
      dsc: '涩涩',
      event: 'message',
      priority: 5000,
      rule: [
        {
          reg: '^#椰奶tag(.*)$',
          fnc: 'setutag'
        },
        {
          reg: '^#(setu|无内鬼)$',
          fnc: 'setu'
        },
        {
          reg: '^#撤回间隔[0-9]+$',
          fnc: 'setrecall'
        },
        {
          reg: '^#群cd[0-9]+$',
          fnc: 'groupcd'
        },
        {
          reg: '^#(开启|关闭)(私聊)?涩涩$',
          fnc: 'setsese'
        },
        {
          reg: '^.*cd[0-9]+$',
          fnc: 'atcd'
        }
      ]
    })
    this.fk = "./plugins/yenai-plugin/resources/img/风控.png"
    this.path_folder = "./plugins/yenai-plugin/config/setu"
    this.path = "./plugins/yenai-plugin/config/setu/setu.json"
    this.path_s = "./plugins/yenai-plugin/config/setu/setu_s.json"
  }

  async init() {
    if (!fs.existsSync(this.path_folder)) {
      fs.mkdirSync(this.path_folder)
    }
  }

  async setu(e) {
    if (!await redis.get(`yenai:notice:sese`)) return;

    let cds = await this.getcd(e)

    if (cds) return e.reply(`你是被下半身控制了大脑吗，等${cds}再来冲吧~~`, false, { at: true })

    let r18 = await this.getr18(e)

    let res = await this.setuapi(r18)

    if (!res) return e.reply("接口失效")

    let imgs = res[0]

    this.sendMsg(e, imgs.urls.original, imgs.pid)

  }

  //tag搜图
  async setutag(e) {
    if (!await redis.get(`yenai:notice:sese`)) return;

    let cds = await this.getcd(e)

    if (cds) return e.reply(`你是被下半身控制了大脑吗，等${cds}再来冲吧~~`, false, { at: true })

    let msg = e.msg.replace(/#|椰奶tag/g, "").trim()

    if (!msg) return e.reply("tag为空！！！", false, { at: true })

    msg = msg.split(" ")

    if (msg.length > 3) return e.reply("tag最多只能指定三个哦~", false, { at: true })

    msg = msg.map((item) => {
      return `&tag=${item}`
    })

    msg = msg.join("");

    let r18 = await this.getr18(e)
    //接口
    let res = await this.setuapi(r18, 1, msg)

    if (!res) return e.reply("❎ 接口失效")

    if (res.length == 0) return e.reply("没有找到相关的tag", false, { at: true })

    let imgs = res[0]
    //发送消息
    this.sendMsg(e, imgs.urls.original, imgs.pid)
  }

  //设置撤回间隔
  async setrecall(e) {
    if (!e.isGroup) return e.reply("❎ 请在群聊使用此指令");

    if (!e.isMaster) return e.reply("❎ 该命令仅限管理员可用", true);

    let recall = e.msg.replace(/#|撤回间隔/g, "").trim()

    let res = {};

    if (!fs.existsSync(this.path)) {
      res = await Config.getread(this.path)
    }

    if (!res[e.group_id]) res[e.group_id] = def

    res[e.group_id].recall = Number(recall)

    if (await Config.getwrite(this.path, res)) {
      e.reply(`✅ 设置群${e.group_id}撤回间隔${recall}s成功`)
    } else {
      e.reply(`❎ 设置失败`)
    }

  }

  //群CD
  async groupcd(e) {
    if (!e.isMaster) return e.reply("❎ 该命令仅限管理员可用", true);

    let cd = e.msg.replace(/#|群cd/g, "").trim()

    let res = {};

    if (fs.existsSync(this.path)) {
      res = await Config.getread(this.path)
    }

    if (!res[e.group_id]) res[e.group_id] = def

    res[e.group_id].cd = Number(cd)

    if (await Config.getwrite(this.path, res)) {
      e.reply(`✅ 设置群${e.group_id}CD成功，CD为${cd}s`)
      temp = {};
    } else {
      e.reply(`❎ 设置失败`)
    }
  }

  //开启r18
  async setsese(e) {
    if (!e.isMaster) return e.reply("❎ 该命令仅限管理员可用", true);

    let yes = false
    let res = {};

    if (/开启/.test(e.msg)) yes = true

    if (/私聊/.test(e.msg) || !e.isGroup) {

      if (fs.existsSync(this.path_s)) {
        res = await Config.getread(this.path_s)
      }

      res.friendr18 = yes ? 1 : 0

      if (await Config.getwrite(this.path_s, res)) {
        e.reply(`✅ 已${yes ? "开启" : "关闭"}私聊涩涩功能~`)
      } else {
        e.reply(`❎ 设置失败`)
      }

      return;
    }

    if (fs.existsSync(this.path)) {
      res = await Config.getread(this.path)
    }

    if (!res[e.group_id]) res[e.group_id] = def


    res[e.group_id].r18 = yes ? 1 : 0

    if (await Config.getwrite(this.path, res)) {
      e.reply(`✅ 已${yes ? "开启" : "关闭"}${e.group_id}的涩涩模式~`)
    } else {
      e.reply(`❎ 设置失败`)
    }

  }

  //单独设置私聊cd
  async atcd(e) {
    if (e.message[0].type != "at") return;

    if (!e.isGroup) return e.reply("❎ 请在群聊使用此指令");

    if (!e.isMaster) return e.reply("❎ 该命令仅限管理员可用", true);

    let cd = e.msg.match(/[0-9]\d*/g)

    if (!cd) return e.reply("❎ CD为空，请检查", true);

    let qq = e.message[0].qq

    let res = {};
    if (fs.existsSync(this.path_s)) {
      res = await Config.getread(this.path_s)
    }

    res[qq] = Number(cd)
    if (await Config.getwrite(this.path_s, res)) {
      e.reply(`✅ 设置用户${qq}的cd成功，cd时间为${cd}秒`)
      delete temp[qq]
    } else {
      e.reply(`❎ 设置失败`)
    }

  }

  //请求api
  async setuapi(r18, num = 1, tag = "") {
    let url = `${api}?r18=${r18}&num=${num}${tag}`;
    let result = await fetch(url).then(res => res.json()).catch(err => console.log(err))
    if (!result) return false;
    return result.data
  }


  //发送消息
  async sendMsg(e, imgs, pid) {
    //获取配置
    let cfgs = {};
    if (fs.existsSync(this.path)) {
      cfgs = await Config.getread(this.path)
    }
    //默认撤回间隔
    let time = def.recall
    //默认CD
    let cd = def.cd
    //获取当前时间
    let present = parseInt(new Date().getTime() / 1000)
    //消息
    let msg = [segment.at(e.user_id), segment.image(imgs), `https://www.pixiv.net/artworks/${pid}`]
    if (e.isGroup) {
      //看看有没有设置
      if (cfgs[e.group_id]) {
        time = cfgs[e.group_id].recall
        cd = cfgs[e.group_id].cd
      }
      //发送消息并写入cd
      let res = await e.group.sendMsg(msg)
        .then((item) => {
          if (!e.isMaster) {
            if (cd != 0) {
              temp[e.user_id + e.group_id] = present + cd
              setTimeout(() => {
                delete temp[e.user_id + e.group_id];
              }, cd * 1000);
            }
          }
          return item
        }).catch(() => {
          e.reply(segment.image(this.fk))
          logger.error("[椰奶]Bot被风控，发送被风控图片")
        })
      //撤回间隔
      if (time > 0 && res && res.message_id) {
        setTimeout(() => {
          e.group.recallMsg(res.message_id);
          logger.mark("[椰奶]执行撤回")
        }, time * 1000);
      }
    } else {
      //私聊
      let CD = {};
      if (fs.existsSync(this.path_s)) {
        CD = await Config.getread(this.path_s)
      }
      if (CD[e.user_id]) {
        CD = CD[e.user_id]
      } else {
        CD = def.cd
      }

      await e.friend.sendMsg(msg)
        .then(() => {
          if (!e.isMaster) {
            if (CD != 0) {
              temp[e.user_id] = present + CD
              setTimeout(() => {
                delete temp[e.user_id];
              }, CD * 1000);
            }
          }
        }).catch((err) => {
          e.reply(segment.image(this.fk))
        })
    }
  }

  //CD
  async getcd(e) {
    //获取现在的时间并转换为秒
    let present = parseInt(new Date().getTime() / 1000)

    if (e.isGroup) {

      if (temp[e.user_id + e.group_id]) {

        let over = (temp[e.user_id + e.group_id] - present)

        return Config.getsecond(over)

      } else return false

    } else {
      if (temp[e.user_id]) {

        let over = (temp[e.user_id] - present)

        return Config.getsecond(over)

      } else return false
    }
  }

  //获取r18
  async getr18(e) {
    let cfgs
    if (e.isGroup) {
      //获取配置
      if (fs.existsSync(this.path)) {
        cfgs = await Config.getread(this.path)
      } else return def.r18

      if (cfgs[e.group_id]) {
        return cfgs[e.group_id].r18
      } else {
        return def.r18
      }
    } else {
      if (fs.existsSync(this.path)) {
        cfgs = await Config.getread(this.path_s)
      } else return def.r18

      if (cfgs.friendr18) {
        return cfgs.friendr18
      } else {
        return def.r18
      }

    }
  }

}