# 服务器部署

使用 baohu 同一台服务器 `101.133.168.66`，独立站点 `codex-reset.opentunnel.asia`。
Node 22 容器只监听本机，由宝塔 Nginx 提供 HTTPS；不需要安装 npm 依赖或执行前端构建。

## GitHub Actions 自动发布

推送到 `main` 自动运行 `.github/workflows/deploy.yml`，也可以在 GitHub Actions 的 **Deploy → Run workflow** 手动触发。
其他分支不会部署。使用 Node 22，复用 `npm run deploy`：先检查，再打包、上传并切换容器，最后检查公网入口。
此项目没有 npm 依赖或构建步骤，无需执行 `npm ci`。

GitHub 仓库需配置两个 Actions secrets：

- `SSH_PRIVATE_KEY`：本项目专用的部署私钥，对应公钥安装在服务器 `/root/.ssh/authorized_keys`，使用 `restrict` 禁止端口转发和 PTY 等功能。
- `SSH_KNOWN_HOSTS`：通过已认证的 SSH 连接核对的服务器公钥。工作流严格校验主机身份，不在发布时临时信任扫描结果。

工作流仅有仓库读取权限，官方 Actions 固定到提交；凭据写入 runner 临时目录并在结束时删除。
发布串行执行，不中途取消正在切换的任务；服务器文件锁也防止与手动发布重叠。
Actions 只允许打包触发提交的干净工作区，发布后核对公网 `release.commit`、发布 ID、内容指纹、静态文件和实际 feed。
只有这些检查通过，工作流才报告成功。若公网验证失败，工作流会报错；先检查原因，再按需回滚。

## 手动发布、状态与回滚

```bash
npm run deploy
bash deploy/remote-deploy.sh status
bash deploy/remote-deploy.sh logs
bash deploy/remote-deploy.sh rollback
```

默认使用 `root@101.133.168.66` 和 `~/.ssh/sketchive_deploy_ed25519`。
可用 `SERVER_HOST`、`SERVER_USER`、`SSH_PORT`、`SSH_KEY`、`SSH_KNOWN_HOSTS_FILE` 覆盖连接配置，密钥不进入源码或部署包。

发布包含当前工作区的运行文件。`RELEASE.json` 记录基础 Git 提交、是否有未提交修改和每个文件的 SHA-256；
`/__health` 返回发布 ID 和内容指纹，因此未提交的修复也能准确核对，不能只看 Git 提交号。

脚本先运行日历、HTTP 与发布验证器的回归检查，将文件复制成独立快照，再上传至 `/root/codex-reset/releases/<发布ID>`。
服务器验证所有文件摘要，在 blue / green 两个容器槽位间切换，分别绑定 `127.0.0.1:8091` 和 `8092`。
候选容器的健康接口和真实 feed 通过后，才切换 `/root/codex-reset/active-proxy.conf` 并平滑加载 Nginx。
已配置 HTTPS 时还会核对 TLS 入口返回的发布 ID，失败恢复旧入口；上一版本保留以供回滚。
切换成功后，从发布机器通过公网核对当前发布和全部静态文件；不要同时进行手动发布和 Actions 发布。

每个容器使用非 root 用户、只读文件系统、192MB 内存上限、自动重启和滚动日志。
发布不会清理其他项目的容器、镜像或数据。

## 首次接入

1. DNS 添加 `codex-reset` 的 A 记录，值为 `101.133.168.66`。
2. 执行发布脚本，先启动本机服务。未配置站点时脚本明确提示仅容器就绪。
3. 签发 `codex-reset.opentunnel.asia` 的证书，安装到
   `/www/server/panel/vhost/cert/codex-reset.opentunnel.asia/`，文件名为 `fullchain.pem` 和 `privkey.pem`。
4. 将 `deploy/codex-reset.nginx.conf` 安装为 `/www/server/panel/vhost/nginx/codex-reset.conf`。
   先运行 `nginx -t`，成功后执行 `nginx -s reload`。
5. 从公网检查 HTTPS、`/__health`、`/api/feed?locale=zh` 和实际页面。

服务器的 HTTP 80 端口目前会被阿里云备案提示拦截，HTTP-01 证书验证不可用。
使用服务器现有 acme.sh / Let's Encrypt 账户进行 DNS 验证。未配置 DNS API 凭据时，
手动 DNS 验证的证书不能无人值守续期；续期需更新验证 TXT 并运行 acme.sh，不能把现有 cron 视为续期已配置。

2026-10-19 已签发并安装证书，到期时间为 **2027-01-17 09:11:18 UTC**（北京时间 17:11:18）。
建议在 2026 年 12 月办理续期。使用当前手动 DNS 方式时，先在服务器运行以下命令取得本次 TXT 值：

```bash
/root/.acme.sh/acme.sh --renew --server letsencrypt \
  -d codex-reset.opentunnel.asia --ecc \
  --yes-I-know-dns-manual-mode-enough-go-ahead-please
```

按输出更新 `_acme-challenge.codex-reset` 的 TXT，等待权威 DNS 返回新值后再次运行。
不要复用首次签发的 TXT 值。acme.sh 已保存证书安装路径和 Nginx 检查、重载命令；
续期后仍需核对公网实际证书的到期时间。

## 线上核对

```bash
curl -fsS https://codex-reset.opentunnel.asia/__health
curl -fsS 'https://codex-reset.opentunnel.asia/api/feed?locale=zh'
```

健康检查通过只表示应用进程正常。发布后仍需核对实际页面、接口数据和活动日历内容。

2026-10-19 公网检查通过：HTTPS 证书验证、四个页面路由、feed / timeline / status 接口，以及 29 个静态文件的字节比对。
首次手动发布 ID 为 `20261019T100446Z-2efac1dbe3ff`，当时包含基于 `d007eb3` 的未提交修复；
不能用该 Git 提交代替那次发布内容。首次接入已实际回滚至 blue 后恢复 green。
后续当前版本以 `/__health` 和 GitHub Actions 运行记录为准。
