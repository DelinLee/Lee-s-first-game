# Lee 的梦想大陆

一个纯静态的个人游戏小站：主页是一张可交互的像素风大陆地图，
鼠标移到建筑上会发光放大，点击「艾格农场」进入第一个游戏《小艾抓蛋仔大作战》。

## 本地游玩

双击根目录的 `启动游戏.bat`（自动起本地服务器并打开浏览器）。
或手动：

```powershell
cd 本目录
python -m http.server 5500
```

然后打开 `http://localhost:5500/`。
⚠️ 不能直接双击 index.html（file:// 下读取图片像素会被浏览器拦截）。

## 结构

- `index.html` + `continent.css` + `continent.js` —— 主页交互地图（逐像素命中，配置在 continent.js 顶部 REGIONS）
- `assets/ui/` —— 主页素材：`continent_base.png`(空底图) + `layer_*.png`(5 个建筑分层)
- `games/xiaoai-egg-catch/` —— 抓蛋游戏（开始页 / game.html 玩法 / farm.html 蛋蛋农场 / save.js 存档 / audio.js 音效）
- `_assemble.py` —— 主页素材组装脚本：洋红抠像 + 按 PLACE 参数摆放，重画素材后重跑即可

## 部署（GitHub Pages 等静态托管）

全站相对路径，直接把整个目录发布即可；入口是根目录 `index.html`。
适合 `https://用户名.github.io/仓库名/` 这类子路径部署。

## 给后续维护者

进度、素材来源、技术坑点见 `HANDOFF.md`。
