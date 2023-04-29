---
title: 首页
home: true
icon: home
heroImage: /img/logo.gif
heroText: Yenai-plugin
tagline: 一个具有强大功能的 Yunzai-Bot 扩展插件🐏
actions:
  - text: 快速上手 💡
    link: /about
    type: primary
  - text: 介绍 🪀
    link: /about#介绍-👀
    type: secondary
  - text: 配置 🛠
    link: /config/
    type: secondary
  - text: 打赏 ❤️
    link: /donate
    type: secondary
features:
- title: 申请处理
  details: 不需要登录Bot账号即可处理请求
  icon: any
  link: /features/Assistant#事件处理
- title: 修改信息
  details: 不需要登录Bot账号即可修改Bot头像、网名等
  icon: info
  link: /features/Assistant#改-bot-信息
- title: 发送消息
  details: 远程使用Bot账号发送消息
  icon: news
  link: /features/Assistant#发送消息
- title: 事件通知
  details: 实时掌握Bot动态
  icon: notice
  link: /features/Notice
- title: 群聊管理
  details: 丰富的群管功能，让违规的人无处可逃
  icon: group
  link: /features/GroupAdmin
- title: Pixiv
  details: Pixiv功能，在QQ就能逛P站
  icon: dart
  link: /features/Pixiv
- title: 以图搜图
  details: 还在为找不到图片来源烦恼吗
  icon: pic
  link: /features/PicSearch
- title: 哔咔漫画
  details: 哔咔漫画功能，搜索应有尽有
  icon: relation
  link: /features/Bika
---

### 让生活多姿多彩<img src="https://media.giphy.com/media/mGcNjsfWAjY5AEZNw6/giphy.gif" width="50">

::: code-tabs#language

@tab pnpm

```sh
#在Yunzai-Bot根目录执行
git clone --depth=1 https://github.com/yeyang52/yenai-plugin.git ./plugins/yenai-plugin

#安装依赖
pnpm install
```

@tab npm 

```sh
#在Yunzai-Bot根目录执行
git clone --depth=1 https://github.com/yeyang52/yenai-plugin.git ./plugins/yenai-plugin

#安装依赖
npm install
```

@tab yarn

```sh
#在Yunzai-Bot根目录执行
git clone --depth=1 https://github.com/yeyang52/yenai-plugin.git ./plugins/yenai-plugin

#安装依赖
yarn install
```
:::
::: warning
Yenai-plugin仅适配[Yunzai-Bot V3](https://gitee.com/Le-niao/Yunzai-Bot)
:::
