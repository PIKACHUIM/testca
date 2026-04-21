export const CPS_ZH = `# 皮卡丘公共测试根证书策略

## 1. 策略引言

皮卡丘公共测试根证书策略（以下简称"本策略"）规范皮卡丘数字证书信任系统（以下简称"CA"）颁发的数字证书的使用与管理。本策略适用于 CA 颁发的全部证书。

## 2. 名词定义

- **证书颁发机构（CA）**：皮卡丘数字证书信任系统，负责颁发与管理数字证书。
- **证书持有人**：获得由 CA 颁发证书的个人、组织或实体。
- **证书申请人**：向 CA 提交证书申请的个人、组织或实体。

## 3. 证书颁发

### 3.1 证书申请

- 申请人必须提交准确、完整、真实的信息。
- 申请人必须提供身份验证信息。
- 申请人必须遵守 CA 的申请流程。

### 3.2 证书验证

- CA 将对申请人身份进行验证。
- CA 将对申请人资格进行验证。

### 3.3 证书颁发

- 验证通过后 CA 将颁发证书。
- 颁发的证书将包含必要的证书信息。

## 4. 证书使用

- 持有人应妥善保管证书与私钥，防止丢失、泄露或滥用。
- 持有人应仅将证书用于合法授权目的。
- 持有人应遵守相关法律法规与行业标准。

## 5. 证书更新

- 持有人可向 CA 申请更新以延长有效期。
- 持有人必须在到期前申请更新。

## 6. 证书吊销

- 若持有人违反本策略或相关法律，CA 有权吊销证书。
- 吊销后 CA 将及时通知持有人与相关各方。

## 7. 安全措施

- CA 将采取适当措施保护私钥与相关信息。
- CA 将定期审查与更新安全策略。

## 8. 法律争议

- 本策略受适用法律约束。
- 相关争议应通过协商解决；无法达成一致时应提交相关司法机构。
`

export const CPS_EN = `# Pikachu Public Test Root Certificate Policy

## 1. Introduction

This Certification Practice Statement (the "CPS") governs the use and management of digital certificates issued by the Pikachu Certificate Trust System (the "CA"). It applies to all certificates issued by the CA.

## 2. Definitions

- **Certification Authority (CA)**: The Pikachu Certificate Trust System, which issues and manages digital certificates.
- **Certificate Holder**: Any individual, organization, or entity holding a certificate issued by the CA.
- **Certificate Applicant**: Any individual, organization, or entity submitting a certificate request to the CA.

## 3. Certificate Issuance

### 3.1 Application

- Applicants must submit accurate, complete and truthful information.
- Applicants must provide identity verification information.
- Applicants must follow the CA's application process.

### 3.2 Verification

- The CA verifies the applicant's identity.
- The CA verifies the applicant's qualifications.

### 3.3 Issuance

- Upon successful verification, the CA issues the certificate.
- Issued certificates contain the necessary certificate information.

## 4. Certificate Usage

- Holders must securely store certificates and private keys.
- Holders must use certificates for lawful and authorized purposes only.
- Holders must comply with applicable laws, regulations and industry standards.

## 5. Renewal

- Holders may apply to the CA to renew certificates.
- Renewal must be requested before expiration.

## 6. Revocation

- The CA may revoke a certificate if the holder violates this CPS or applicable laws.
- The CA will promptly notify holders and relevant parties upon revocation.

## 7. Security Measures

- The CA implements appropriate measures to protect private keys.
- The CA periodically reviews and updates security policies.

## 8. Legal & Disputes

- This CPS is subject to applicable laws.
- Disputes should be resolved through negotiation; otherwise submitted to relevant judicial authorities.
`
