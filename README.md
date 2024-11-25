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

|                 通用名称(CN)/名称(Name)                  |                     组织（O）                     |                       组织机构（OU）                       |                     描述（Description）                      |                       证书策略（CPS）                        |       OCSP服务<br/>(OCSP)        |       吊销列表<br/>(CRL List)        |                   下载证书<br/>(Download)                    | 导入证书<br/>Setup CA  |
| :------------------------------------------------------: | :-----------------------------------------------: | :--------------------------------------------------------: | :----------------------------------------------------------: | :----------------------------------------------------------: | :------------------------------: | :----------------------------------: | :----------------------------------------------------------: | ---------------------- |
| **皮卡丘公共测试根RSA**<br/>Pikachu Public Test Root RSA | **皮卡丘信任网络CA**<br/>Pikachu Trust Network CA | **皮卡丘证书颁发机构**<br/>Pikachu Certification Authority | **皮卡丘公共服务测试根证书 RSA**<br/>Pikachu Public Test Root RSA | **PDF**：[中文](CPS-CN.pdf)  [English](CPS-EN.pdf)<br/>**TXT**：[中文](CPS-CN.html)  [English](CPS-EN.html) | [OCSP](https://test.ocsps.us.kg) | [2025-2050](certs/rootca/rootca.crl) | **[CER](certs/rootca/rootca.cer)** **[CRT](certs/rootca/rootca.crt)** **[DER](certs/rootca/rootca.der)** **[P7B](certs/rootca/rootca.p7b)** | [Windows](Setupca.zip) |

## 中级证书列表 / Intermediate Sub CA

| **通用名称(CN)/名称(Name)** |                   **描述（Description）**                    |           **吊销列表<br/>(Revocation List)**           |                         **证书下载**                         |
| :-------------------------: | :----------------------------------------------------------: | :----------------------------------------------------: | :----------------------------------------------------------: |
|   **Pikachu Time Sub CA**   | **皮卡丘时间戳签署中间子证书CA (Pikachu Time Signning Sub CA)** | **[2025/01/01 - 2050/01/01](certs/timeca/timeca.crl)** | **[CER](certs/timeca/timeca.cer)  / [CRT](certs/timeca/timeca.crt)  / [DER](certs/timeca/timeca.der) / [P7B](certs/timeca/timeca.p7b)** |
|   **Pikachu UEFI Sub CA**   | **皮卡丘UEFI密钥交换证书中间CA (Pikachu UEFI Key Exchange CA)** | **[2025/01/01 - 2050/01/01](certs/uefica/uefica.crl)** | **[CER](certs/uefica/uefica.cer)  / [CRT](certs/uefica/uefica.crt)  / [DER](certs/uefica/uefica.der) / [P7B](certs/uefica/uefica.p7b)** |
|   **Pikachu Code Sub CA**   | **皮卡丘公共测试代码证书中间CA (Pikachu Code Signning Sub CA)** |   [2025/01/01 - 2050/01/01](certs/codeca/codeca.crl)   | **[CER](certs/codeca/codeca.cer)**  / **[CRT](certs/codeca/codeca.crt)**  / **[DER](certs/codeca/codeca.der)** / **[P7B](certs/codeca/codeca.p7b)** |

## 申请个人证书 / Apply New Certificate

|            **CA机构<br/>Certificate Authority **             |                 **有效时间 <br/>Valid Time**                 | **邮件地址<br/>Email Address**                               | **国家<br/>Country**                                         | **省份<br/>State**                                           | **城市<br/>Location**                                        | **组织<br/>Organization**                                    | **组织单元<br/>Org Unit**                                    |                 **备注信息<br/>Description**                 |                   **提交申请<br/>Submit**                    |
| :----------------------------------------------------------: | :----------------------------------------------------------: | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ | :----------------------------------------------------------: | :----------------------------------------------------------: |
| <select id="ca_name" name="ca_name" style="width: 370px" data-placeholder="选择项目" required><option value="time">**Pikachu Time Sub CA**（申请时间签名证书）</option> <option value="uefi">**Pikachu UEFI Sub CA**（申请UEFI签名证书）</option><option value="code">**Pikachu Code Sub CA**（申请时间代码证书）</option></select> | <select id="va_time" name="va_time" style="width: 220px" data-placeholder="选择项目" required><option value="1">**2000/01/01~2024/12/31**</option><option value="2">**2025/01/01~2049/12/31**</option><option value="3">**2050/01/01~2074/12/31**</option><option value="4">**2075/01/01~2099/12/31**</option></select> | <input id="in_mail" type="text"  name="in_mail"  style="width: 100px;text-align: center;"> | <input id="in_code" type="text" maxlength="2" name="in_code" placeholder="CN" value="CN"  style="width: 60px;text-align: center;"> | <input id="in_main" type="text" name="in_main" style="width: 100px"> | <input id="in_subs" type="text" name="in_subs" style="width: 100px"> | <input id="in_orgs" type="text" name="in_orgs" style="width: 100px"> | <input id="in_part" type="text" name="in_part" style="width: 100px"> | <input id="in_data" type="text" name="in_data" style="width: 200px"> | <input type="button" value="确认申请(Submit)" onclick="ca_post()" /> |

**备注：证书主体名称（Common Name）无法自定义，将会使用备注信息（Description）区分和替代主体名称（Common Name），证书一旦创建就无法吊销或撤回，私钥泄漏也没有办法禁用，请妥善保管您的证书私钥**

**Certificate’s Common Name can NOT be customized on this Service, please fill in and use Description instead. Once a cert is created, it cannot be revoked. Please keep your private key safe.**



<script>
function ca_post(parameters) {
  var ca_name_obj = document.getElementById("ca_name");
  var va_time_obj = document.getElementById("va_time");
  var in_data_obj = document.getElementById("in_data");
  var in_code_obj = document.getElementById("in_code");
  var in_main_obj = document.getElementById("in_main");
  var in_subs_obj = document.getElementById("in_subs");
  var in_orgs_obj = document.getElementById("in_orgs");
  var in_part_obj = document.getElementById("in_part");
  var in_mail_obj = document.getElementById("in_mail");
  var ca_name_txt = ca_name_obj.value;
  var va_time_txt = va_time_obj.value;
  var in_data_txt = in_data_obj.value;
  var in_code_txt = in_code_obj.value;
  var in_main_txt = in_main_obj.value;
  var in_subs_txt = in_subs_obj.value;
  var in_orgs_txt = in_orgs_obj.value;
  var in_part_txt = in_part_obj.value;
  var in_mail_txt = in_mail_obj.value;
  if(ca_name_txt.length<=0){
      window.alert("请选择颁发机构\nPlease select the Certificate Authority.");
      return False;
  }
  if(va_time_txt.length<=0){
      window.alert("请选择有效时间\nPlease select an Valid Time.");
      return False;
  }
  if(in_mail_txt.length<=0){
      window.alert("请填写邮件地址\nPlease fill in the Email Address.");
      return False;
  }
  if(in_main_txt.length<=0){
      window.alert("请填写所在省份\nPlease fill in the State where you are located.");
      return False;
  }
  if(in_subs_txt.length<=0){
      window.alert("请填写所在城市\nPlease fill in the Location where you are located.");
      return False;
  }
  if(in_orgs_txt.length<=0){
      window.alert("请填写您的组织\nPlease fill in your Organization.");
      return False;
  }
  if(in_part_txt.length<=0){
      window.alert("请填写您的部门\nPlease fill in your Organizational Unit.");
      return False;
  }
  if(in_data_txt.length<=0){
      window.alert("请填写备注信息\nPlease fill in your Description.");
      return False;
  }
  if(/^[A-Z]{2}$/.test(in_code_txt)){
      window.location.href = "https://post.certs.us.kg/?ca_name="+ca_name_txt+"&va_time="+va_time_txt+"&in_data="+in_data_txt+"&in_code="+in_code_txt+"&in_main="+in_main_txt+"&in_subs="+in_subs_txt+"&in_orgs="+in_orgs_txt+"&in_part="+in_part_txt+"&in_mail="+in_mail_txt;
  }else{
      window.alert("国家字段必须是两位大写字母\nThe country must be two capital letters.");
  }
}
</script>

