# 皮卡丘公共服务测试根证书 RSA在线验证服务

# Pikachu Public Test Root RSA Online Service



## 本网站介绍

皮卡丘公共服务测试根证书 RSA提供公共自签名代码签名、时间戳服务、UEFI固件认证签名、Windows驱动签名以及驱动签名策略自定义服务

Pikachu Public Service Test Root Certificate RSA provides public self signed code signature, timestamp service, UEFI firmware authentication signature, Windows driver signature, and driver signature policy customization service

## 根证书列表 / CA Certificates Detail

| 国家代码（C） |                 通用名称(CN)/名称(Name)                  |                     组织（O）                     |                       组织机构（OU）                       |                     描述（Description）                      |                       证书策略（CPS）                        |          OCSP服务<br/>(OCSP Server)          |           吊销列表<br/>(Revocation List)           |                 下载证书<br/>(Download Cert)                 |
| :-----------: | :------------------------------------------------------: | :-----------------------------------------------: | :--------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :------------------------------------------: | :------------------------------------------------: | :----------------------------------------------------------: |
|    **CN**     | **皮卡丘公共测试根RSA**<br/>Pikachu Public Test Root RSA | **皮卡丘信任网络CA**<br/>Pikachu Trust Network CA | **皮卡丘证书颁发机构**<br/>Pikachu Certification Authority | **皮卡丘公共服务测试根证书 RSA**<br/>Pikachu Public Test Root RSA | **PDF**：[简体中文](CPS-CN.pdf)  [English](CPS-EN.pdf)<br/>**TXT**：[简体中文](CPS-CN.html)  [English](CPS-EN.html) | [test.ocsps.us.kg](https://test.ocsps.us.kg) | [2025/01/01 - 2050/01/01](certs/rootca/rootca.crl) | **[CER](certs/rootca/rootca.cer)**  / **[CRT](certs/rootca/rootca.crt)**  / **[DER](certs/rootca/rootca.der)** / **[P7B](certs/rootca/rootca.p7b)** |

## 子证书列表 / Middle CA Detail

|        证书         | 说明                                                        |           吊销列表<br/>(Revocation List)           |                           证书下载                           |
| :-----------------: | :---------------------------------------------------------- | :------------------------------------------------: | :----------------------------------------------------------: |
| Pikachu Time Sub CA | 皮卡丘时间戳签署中间子证书CA (Pikachu Time Signning Sub CA) | [2025/01/01 - 2050/01/01](certs/timeca/timeca.crl) | **[CER](certs/timeca/timeca.cer)**  / **[CRT](certs/timeca/timeca.crt)**  / **[DER](certs/timeca/timeca.der)** / **[P7B](certs/timeca/timeca.p7b)** |
| Pikachu UEFI Sub CA | 皮卡丘UEFI密钥交换证书中间CA (Pikachu UEFI KeyExchange CA)  | [2025/01/01 - 2050/01/01](certs/uefica/uefica.crl) | **[CER](certs/uefica/uefica.cer)**  / **[CRT](certs/uefica/uefica.crt)**  / **[DER](certs/uefica/uefica.der)** / **[P7B](certs/uefica/uefica.p7b)** |
| Pikachu Code Sub CA | 皮卡丘公共测试代码证书中间CA (Pikachu Code Signning Sub CA) | [2025/01/01 - 2050/01/01](certs/codeca/codeca.crl) | **[CER](certs/codeca/codeca.cer)**  / **[CRT](certs/codeca/codeca.crt)**  / **[DER](certs/codeca/codeca.der)** / **[P7B](certs/codeca/codeca.p7b)** |

