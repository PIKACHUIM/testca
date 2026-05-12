# SSH2 CA 证书目录

请将以下文件放置到此目录：
- `ssh2ca.der` — SSH2 中间 CA 的 X.509 DER 格式证书
- `ssh2ca.crl` — SSH2 CA 的证书吊销列表
- `ssh2ca.p7b` — SSH2 CA 的 PKCS#7 证书链

这些文件由根 CA 签发生成，用于 SSH2 证书的在线签发服务。
