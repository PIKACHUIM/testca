# 皮卡丘公共服务测试根证书 RSA在线验证服务

# Pikachu Public Test Root RSA Online Service



## 网站服务介绍 / Service Information

**皮卡丘公共服务测试根证书 RSA提供公共自签名代码签名、时间戳服务、UEFI固件认证签名、Windows驱动签名以及驱动签名策略自定义服务**

**Pikachu Public Service Test Root Certificate RSA provides public self signed code signature, timestamp service, UEFI firmware authentication signature, Windows driver signature, and driver signature policy customization service.**

## 重要信息提示 / Significant Notices

- **此CA机构签出的时间戳和证书不会校验真实性和申请来源身份，任何人均可以随意生成任意时间戳和未经验证的证书！！！**

- **此CA机构签出的时间戳和证书仅用于测试用途，不应用于重要场合或者生产环境，未经验证的证书不应在实践中使用！！！**

- **The timestamps and certificates signed out by this CA institution will not be verify. Anyone can generate any timestamp and unverified certificate at will**.
- **The timestamp and certificate issued by this CA organization are only for testing purposes and should not be used in important occasions or production environments. **

## 根CA证书列表 / Root CA Information

|                 通用名称(CN)/名称(Name)                  |                     组织（O）                     |                       组织机构（OU）                       |                     描述（Description）                      |                       证书策略（CPS）                        |          OCSP服务<br/>(OCSP Server)          |           吊销列表<br/>(Revocation List)           |                 下载证书<br/>(Download Cert)                 |
| :------------------------------------------------------: | :-----------------------------------------------: | :--------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :------------------------------------------: | :------------------------------------------------: | :----------------------------------------------------------: |
| **皮卡丘公共测试根RSA**<br/>Pikachu Public Test Root RSA | **皮卡丘信任网络CA**<br/>Pikachu Trust Network CA | **皮卡丘证书颁发机构**<br/>Pikachu Certification Authority | **皮卡丘公共服务测试根证书 RSA**<br/>Pikachu Public Test Root RSA | **PDF**：[简体中文](CPS-CN.pdf)  [English](CPS-EN.pdf)<br/>**TXT**：[简体中文](CPS-CN.html)  [English](CPS-EN.html) | [test.ocsps.us.kg](https://test.ocsps.us.kg) | [2025/01/01 - 2050/01/01](certs/rootca/rootca.crl) | **[CER](certs/rootca/rootca.cer)**  / **[CRT](certs/rootca/rootca.crt)**  / **[DER](certs/rootca/rootca.der)** / **[P7B](certs/rootca/rootca.p7b)** |

## 中级证书列表 / Intermediate Sub CA

| **通用名称(CN)/名称(Name)** |                   **描述（Description）**                    |           **吊销列表<br/>(Revocation List)**           |                         **证书下载**                         |
| :-------------------------: | :----------------------------------------------------------: | :----------------------------------------------------: | :----------------------------------------------------------: |
|   **Pikachu Time Sub CA**   | **皮卡丘时间戳签署中间子证书CA (Pikachu Time Signning Sub CA)** | **[2025/01/01 - 2050/01/01](certs/timeca/timeca.crl)** | **[CER](certs/timeca/timeca.cer)  / [CRT](certs/timeca/timeca.crt)  / [DER](certs/timeca/timeca.der) / [P7B](certs/timeca/timeca.p7b)** |
|   **Pikachu UEFI Sub CA**   | **皮卡丘UEFI密钥交换证书中间CA (Pikachu UEFI Key Exchange CA)** | **[2025/01/01 - 2050/01/01](certs/uefica/uefica.crl)** | **[CER](certs/uefica/uefica.cer)  / [CRT](certs/uefica/uefica.crt)  / [DER](certs/uefica/uefica.der) / [P7B](certs/uefica/uefica.p7b)** |
|   **Pikachu Code Sub CA**   | **皮卡丘公共测试代码证书中间CA (Pikachu Code Signning Sub CA)** |   [2025/01/01 - 2050/01/01](certs/codeca/codeca.crl)   | **[CER](certs/codeca/codeca.cer)**  / **[CRT](certs/codeca/codeca.crt)**  / **[DER](certs/codeca/codeca.der)** / **[P7B](certs/codeca/codeca.p7b)** |

## 申请个人证书 / Apply New Certificate

|             **CA机构 / Certificate Authority **              |                  **有效时间 / Valid Time**                   |      **主体附加信息 / Subject Additional Information**       |                    **提交申请 / Submit**                     |
| :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: |
| <select id="ca_name" name="ca_name" style="width: 370px" data-placeholder="选择项目" required><option value="time">**Pikachu Time Sub CA**（申请时间签名证书）</option> <option value="uefi">**Pikachu UEFI Sub CA**（申请UEFI签名证书）</option><option value="code">**Pikachu Code Sub CA**（申请时间代码证书）</option></select> | <select id="va_time" name="va_time" style="width: 220px" data-placeholder="选择项目" required><option value="1">**2000/01/01~2024/12/31**</option><option value="2">**2025/01/01~2049/12/31**</option><option value="3">**2050/01/01~2074/12/31**</option><option value="4">**2075/01/01~2099/12/31**</option></select> | <input id="in_data" type="text" name="in_data" style="width: 500px"> | <input type="button" value="确认申请(Submit)" onclick="ca_post()" /> |




<script>
function ca_post(parameters) {
  var ca_name_obj = document.getElementById("ca_name");
  var va_time_obj = document.getElementById("va_time");
  var in_data_obj = document.getElementById("in_data");
  var ca_name_txt = ca_name_obj.value;
  var va_time_txt = va_time_obj.value;
  var in_data_txt = in_data_obj.value;
  window.location.href = "https://post.certs.us.kg/?ca_name="+ca_name_txt+"&va_time="+va_time_txt+"&in_data="+in_data_txt;
}
</script>