export const PRIVACY_ZH = `# 隐私声明

## 1. 简介

本声明描述 Pikachu Test CA（以下简称"本服务"）在证书签发过程中如何处理用户信息。本服务仅用于开发与测试用途。

## 2. 收集的信息

证书申请表单会向签发服务器提交以下字段：

- **邮件地址**：用于证书主体 Email 字段。
- **国家 / 省份 / 城市**：用于主体 DN 中的 C / ST / L 字段。
- **组织 / 部门**：用于 O / OU 字段。
- **描述信息**：用于区分不同证书。
- **可选 SAN 域名**：写入 X.509 SAN 扩展。

## 3. 私钥

- 服务器**不会保留**您的私钥。
- 私钥在签发页面一次性提供给您。
- 离开页面后私钥无法再次获取。

## 4. 日志与缓存

- 签发服务器可能记录访问日志用于运维。
- 本前端页面仅在浏览器 localStorage 中保存**语言**与**主题**偏好。
- 不使用任何第三方分析工具。

## 5. 人机验证

- 申请页集成第三方验证码（DingXiang Captcha）。
- 仅用于防止批量滥用，不用于识别身份。

## 6. 联系与反馈

本服务不收集任何联系方式以外的个人数据。若对隐私有疑问，请通过 GitHub Issue 反馈。
`

export const PRIVACY_EN = `# Privacy Notice

## 1. Introduction

This notice describes how Pikachu Test CA (the "Service") handles user information during certificate issuance. The Service is intended for development and testing use only.

## 2. Information Collected

The application form submits the following fields to the issuance server:

- **Email**: used for the Email field of the certificate subject.
- **Country / State / City**: used as C / ST / L fields of the DN.
- **Organization / OU**: used as O / OU fields.
- **Description**: to distinguish between certificates.
- **Optional SAN domains**: written into the X.509 SAN extension.

## 3. Private Key

- The server **does NOT store** your private key.
- Your private key is delivered to you once on the issuance page.
- Once you leave the page the key cannot be recovered.

## 4. Logs & Cache

- The issuance server may keep operational access logs.
- This frontend only stores **language** and **theme** preferences in the browser's localStorage.
- No third-party analytics are used.

## 5. Human Verification

- A third-party captcha (DingXiang) is embedded on the apply page.
- It is used only to prevent abuse, not to identify the user.

## 6. Contact

We do not collect personal data beyond what is in the form. For privacy questions, please open a GitHub Issue.
`
