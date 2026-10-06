# Privacy Notice

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

- Cloudflare Turnstile is embedded on the apply page for bot protection.
- It is used only to prevent abuse, not to identify the user.

## 6. Contact

We do not collect personal data beyond what is in the form. For privacy questions, please open a GitHub Issue.
