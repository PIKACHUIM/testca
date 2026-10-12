import os
import random
import shutil
import string
import traceback
import zipfile
from datetime import datetime

from OpenSSL import crypto
from cryptography.hazmat.bindings._rust import ObjectIdentifier
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import pkcs12
from flask_cors import CORS
from cryptography import x509
from cryptography.x509.oid import NameOID
from flask import Flask, request, send_file
from authy.CaptchaClient import CaptchaClient

app = Flask(__name__)
use = {
    "keyUsage": {
        "time": [b"digitalSignature"],
        "uefi": [b"digitalSignature"],
        "code": [b"digitalSignature"],
        "auth": [b"digitalSignature",
                 b"nonRepudiation",
                 b"keyEncipherment",
                 b"dataEncipherment",
                 b"keyAgreement",
                 b"encipherOnly",
                 b"decipherOnly"],
        "file": [b"keyEncipherment",
                 b"dataEncipherment",
                 b"keyAgreement",
                 b"encipherOnly",
                 b"decipherOnly"],
        "mail": [b"digitalSignature",
                 b"keyAgreement",
                 b"encipherOnly",
                 b"decipherOnly"],
        "mtls": [b"digitalSignature"],
        "sign": [b"digitalSignature",
                 b"nonRepudiation"],
    },
    "extUsage": {
        "time": [b"1.3.6.1.5.5.7.3.8"],
        "uefi": [b"1.3.6.1.5.5.7.3.3",
                 b"1.3.6.1.4.1.311.10.3.6",
                 b"1.3.6.1.4.1.311.10.3.8",
                 b"1.3.6.1.4.1.2312.16.1.1",
                 b"1.3.6.1.4.1.2312.16.1.2",
                 b"1.3.6.1.4.1.2312.16.1.3"],
        "code": [b"1.3.6.1.5.5.7.3.3",
                 b"1.3.6.1.4.1.311.61.1.1",
                 b"1.3.6.1.4.1.311.10.3.5",
                 b"1.3.6.1.4.1.311.10.3.6",
                 b"1.3.6.1.4.1.311.10.3.7",
                 b"1.3.6.1.4.1.311.10.3.8",
                 b"1.3.6.1.4.1.311.10.3.39"],
        "auth": [b"1.3.6.1.5.2.3.4",
                 b"1.3.6.1.5.5.7.3.5",
                 b"1.3.6.1.5.5.7.3.6",
                 b"1.3.6.1.5.5.7.3.17",
                 b"1.3.6.1.5.5.7.3.21",
                 b"1.3.6.1.5.5.7.3.22",
                 b"1.3.6.1.5.5.7.3.23",
                 b"1.3.6.1.5.5.7.3.24",
                 b"1.3.6.1.5.5.7.3.25",
                 b"1.3.6.1.5.5.7.3.26",
                 b"1.3.6.1.5.5.7.3.27",
                 b"1.3.6.1.5.5.7.3.28",
                 b"1.3.6.1.5.5.7.3.29",
                 b"1.3.6.1.5.5.7.3.30",
                 b"1.3.6.1.5.5.8.2.2",
                 b"1.3.6.1.4.1.311.21.1",
                 b"1.3.6.1.4.1.311.21.5",
                 b"1.3.6.1.4.1.311.21.3",
                 b"1.3.6.1.4.1.311.21.4",
                 b"1.3.6.1.4.1.311.21.6",
                 b"1.3.6.1.4.1.311.21.2",
                 b"1.3.6.1.4.1.311.21.10",
                 b"1.3.6.1.4.1.311.10.3.3",
                 b"1.3.6.1.4.1.311.10.3.1",
                 b"1.3.6.1.4.1.311.10.3.9",
                 b"1.3.6.1.4.1.311.10.3.10",
                 b"1.3.6.1.4.1.311.10.5.1",
                 b"1.3.6.1.4.1.311.10.6.1",
                 b"1.3.6.1.4.1.311.10.6.2",
                 b"1.3.6.1.4.1.311.20.2",
                 b"1.3.6.1.4.1.311.20.2.1",
                 b"1.3.6.1.4.1.311.20.2.2",
                 b"1.3.6.1.4.1.311.20.2.3"],
        "file": [b"1.3.6.1.4.1.311.10.3.4",
                 b"1.3.6.1.4.1.311.10.3.4.1",
                 b"1.3.6.1.4.1.311.10.3.11",
                 b"1.3.6.1.4.1.311.67.1.1",
                 b"1.3.6.1.4.1.311.67.1.2"],
        "mail": [b"1.3.6.1.5.5.7.3.4",
                 b"1.3.6.1.4.1.311.21.19",
                 # b"1.3.6.1.5.5.7.3.2"
                 ],
        "mtls": [b"1.3.6.1.5.5.7.3.1",
                 b"1.3.6.1.5.5.7.3.2"],
        "sign": [b"1.2.840.113583.1.1.5",
                 b"1.3.6.1.4.1.311.10.3.12",
                 b"1.3.6.1.4.1.311.10.3.1",
                 b"1.3.6.1.4.1.311.10.3.2",
                 b"1.3.6.1.4.1.311.10.3.13"],
    },
    "urlSign": {
        "root": "certs/rootca/0-Pikachu_Test_CA_RSA",
        "time": "certs/timeca/0.2-Pikachu_Time_Sub_CA",
        "uefi": "certs/uefica/0.3-Pikachu_UEFI_Sub_CA",
        "code": "certs/codeca/0.4-Pikachu_Code_Sub_CA",
        "auth": "certs/authca/0.9-Pikachu_Auth_Sub_CA",
        "file": "certs/fileca/0.6-Pikachu_File_Sub_CA",
        "mail": "certs/mailca/0.7-Pikachu_Mail_Sub_CA",
        "mtls": "certs/mtlsca/0.5-Pikachu_mTLS_Sub_CA",
        "sign": "certs/signca/0.8-Pikachu_Sign_Sub_CA",
    }
}
url = {
    "crl": [
        b"URI:https://pikachuim.github.io/testca/certs/??????/??????.crl",
        b"URI:https://testca.524228.xyz/certs/??????/??????.crl"
    ],
    "aia": [
        b"OCSP;URI:http://ocspca.524228.xyz/",
        b"caIssuers;URI:https://pikachuim.github.io/testca/certs/??????/??????.crt",
        b"caIssuers;URI:https://testca.524228.xyz/certs/??????/??????.crt",
    ],
    "csp": [
        b"ia5org,2.23.140.1.1,2.16.840.1.113730.1,"
        b"1.3.6.1.4.1.37476.9000.173.0;CPS:https://test.certs.us.kg/"
    ],
    "new": {
        "2.23.140.1.1": None,
        "2.16.840.1.113730.1": None,
        "1.3.6.1.4.1.37476.9000.173.0": "https://testca.524228.xyz/Policy.html"
    },
    "ncr": [
        b"https://testca.524228.xyz/certs/??????/??????.crl"
    ],
    "map": {
        "OCSP": '1.3.6.1.5.5.7.48.1',
        "caIssuers": '1.3.6.1.5.5.7.48.2'
    }
}
out = "cache/certs/"
APP_ID = 'b4f11125fb26b4fd3010ba2146cf36a7'
APP_SECRET = '857c0a73e4cd74993102e79a2323a884'
CORS(app)


class Cert:
    @staticmethod
    def spliceStr(in_list: list, in_name):
        result = b""
        for item in in_list:
            if len(result) > 0:
                result += b","
            result += item
        return result.replace(b"??????", in_name.encode())

    @staticmethod
    def issueCert(ca_name: str = "",
                  va_time: int = -1,
                  in_mail: str = "",
                  in_code: str = "",
                  in_main: str = "",
                  in_subs: str = "",
                  in_orgs: str = "",
                  in_orgu: str = "",
                  in_data: str = "",
                  in_coms: str = "",
                  use_old=False
                  ):
        # 必要检查 =========================================
        if ca_name not in use["keyUsage"]:
            return False, "Error CA Options"
        if not 1 <= va_time <= 4:
            return False, "Error Valid Time"
        if len(in_code) * len(in_main) * len(in_subs) < 1:
            return False, "无效的国家代码/省份/城市\nInvalid country code/province/city"
        if len(in_orgs) * len(in_orgu) * len(in_mail) < 1:
            return False, "无效的组织名称/单元/邮件\nInvalid organization name/unit/email"
        ca = ca_name + "ca"
        # 创建密钥 ========================================================================
        main_path = use['urlSign'][ca_name]
        if use_old:
            # -----------------------------------------------------------------------------
            with open(main_path + ".key") as f:
                main_key = crypto.load_privatekey(crypto.FILETYPE_PEM, f.read())
            with open(main_path + ".crt") as f:
                main_cer = crypto.load_certificate(crypto.FILETYPE_PEM, f.read().encode())
            cert_key = crypto.PKey()
            cert_cer = crypto.X509()
            cert_key.generate_key(crypto.TYPE_RSA, 2048)
        else:
            # -----------------------------------------------------------------------------
            with open(main_path + ".key") as f:
                main_key = serialization.load_pem_private_key(f.read().encode(), None)
            with open(main_path + ".crt") as f:
                main_cer = x509.load_pem_x509_certificate(f.read().encode())
            cert_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048,
            )
            cert_cer = x509.CertificateBuilder()
        # 设置信息 ========================================================================================
        name_cer = "Pikachu %s Signer G1-%s" % (
            ca_name.upper() if ca_name == "uefi" else ca_name.capitalize(),
            ''.join(random.choice(string.ascii_uppercase + string.digits) for i in range(0, 6)))
        if use_old:
            if len(in_code) > 0:
                cert_cer.get_subject().C = in_code
            if len(in_main) > 0:
                cert_cer.get_subject().ST = in_main
            if len(in_subs) > 0:
                cert_cer.get_subject().L = in_subs
            if len(in_orgs) > 0:
                cert_cer.get_subject().O = in_orgs
            if len(in_orgu) > 0:
                cert_cer.get_subject().OU = in_orgu
            if len(in_mail) > 0:
                cert_cer.get_subject().emailAddress = in_mail
            if len(in_data) > 0:
                cert_cer.get_subject().description = in_data
            # 主题名称 ------------------------------------------------------------------------------------
            cert_cer.get_subject().CN = name_cer
            cert_cer.set_issuer(main_cer.get_subject())
        else:
            cert_cer = cert_cer.issuer_name(main_cer.subject)
            cert_cer = cert_cer.subject_name(x509.Name([
                x509.NameAttribute(NameOID.COMMON_NAME, name_cer),
                x509.NameAttribute(NameOID.COUNTRY_NAME, in_code),
                x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, in_main),
                x509.NameAttribute(NameOID.LOCALITY_NAME, in_subs),
                x509.NameAttribute(NameOID.ORGANIZATION_NAME, in_orgs),
                x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, in_orgu),
                x509.NameAttribute(NameOID.EMAIL_ADDRESS, in_mail),
                x509.NameAttribute(ObjectIdentifier("2.5.4.13"), in_data),
            ]))
        # 其他信息 -------------------------------------------------------------------------------------
        if use_old:
            cert_cer.set_serial_number(int(random.randbytes(16).hex(), 16))  # 证书序列号信息
            cert_cer.set_notBefore(str(2000 + 25 * (va_time - 1)).encode() + b'0101000000Z')
            cert_cer.set_notAfter(str(2000 + 25 * va_time - 1).encode() + b'1231235959Z')
            cert_cer.set_pubkey(cert_key)
        else:
            cert_cer = cert_cer.serial_number(int(random.randbytes(16).hex(), 16))
            cert_cer = cert_cer.not_valid_before(
                datetime.strptime(str(2000 + 25 * (va_time - 1)) + '0101000000Z', "%Y%m%d%H%M%SZ"))
            cert_cer = cert_cer.not_valid_after(
                datetime.strptime(str(2000 + 25 * va_time - 1) + '1231235959Z', "%Y%m%d%H%M%SZ"))
            cert_cer = cert_cer.public_key(cert_key.public_key())
        # 拓展信息 =====================================================================================
        if use_old:
            cert_cer.add_extensions([
                crypto.X509Extension(b"basicConstraints", True, b"CA:FALSE"),
                crypto.X509Extension(b"keyUsage", True, Cert.spliceStr(use['keyUsage'][ca_name], ca)),
                crypto.X509Extension(b"extendedKeyUsage", True, Cert.spliceStr(use['extUsage'][ca_name], ca)),
                crypto.X509Extension(b"crlDistributionPoints", False, Cert.spliceStr(url['crl'], ca)),
                crypto.X509Extension(b"authorityInfoAccess", False, Cert.spliceStr(url['aia'], ca)),
                crypto.X509Extension(b"nsCaPolicyUrl", False, b"https://test.certs.us.kg/policy.html"),
                crypto.X509Extension(b"nsCaRevocationUrl", False, Cert.spliceStr(url['ncr'], ca)),
                crypto.X509Extension(b"nsCertType", False, b"objsign"),
                # crypto.X509Extension(b"certificatePolicies", False, Cert.spliceStr(url['csp'], ca)),
            ])
        else:
            cert_cer = cert_cer.add_extension(
                x509.BasicConstraints(False, None), True
            )
            in_coms = [i for i in in_coms.split(";") if len(i)>0]
            if len(in_coms)>0:
                cert_cer = cert_cer.add_extension(
                    x509.SubjectAlternativeName(
                        [x509.DNSName(u'%s' % dns_str) for dns_str in in_coms]
                    ), False
                )
            cert_cer = cert_cer.add_extension(
                x509.KeyUsage(
                    b"digitalSignature" in use['keyUsage'][ca_name],
                    b"contentCommitment" in use['keyUsage'][ca_name],
                    b"keyEncipherment" in use['keyUsage'][ca_name],
                    b"dataEncipherment" in use['keyUsage'][ca_name],
                    b"keyAgreement" in use['keyUsage'][ca_name],
                    b"keyCertSign" in use['keyUsage'][ca_name],
                    b"crlSign" in use['keyUsage'][ca_name],
                    b"encipherOnly" in use['keyUsage'][ca_name],
                    b"decipherOnly" in use['keyUsage'][ca_name],
                ), True
            )
            cert_cer = cert_cer.add_extension(
                x509.ExtendedKeyUsage(
                    [ObjectIdentifier(i.decode()) for i in use['extUsage'][ca_name]]
                ), True
            )
            cert_cer = cert_cer.add_extension(
                x509.CRLDistributionPoints([
                    x509.DistributionPoint(
                        full_name=[x509.UniformResourceIdentifier(
                            i[4:].decode().replace("??????", ca))],
                        relative_name=None,
                        reasons=None,
                        crl_issuer=None,
                    ) for i in url['crl']
                ]), False
            )
            cert_cer = cert_cer.add_extension(
                x509.AuthorityInformationAccess([
                    x509.AccessDescription(
                        x509.ObjectIdentifier(url['map'][i.decode().split(";URI:")[0]]),
                        x509.UniformResourceIdentifier(i.decode().split(";URI:")[1].replace("??????", ca))
                    ) for i in url['aia']
                ]), False
            )
            cert_cer = cert_cer.add_extension(
                x509.CertificatePolicies([
                    x509.PolicyInformation(
                        x509.ObjectIdentifier(i),
                        [url['new'][i]] if url['new'][i] is not None else []
                    ) for i in url['new'].keys()
                ]), False)

        # 签署证书 =====================================================================================
        pfx_pass = ''.join(random.choice(string.ascii_letters + string.digits) for i in range(0, 16))
        if use_old:
            cert_cer.sign(main_key, 'sha256')
            cert_sha = str(hex(cert_cer.get_serial_number()))[2:]
            cert_p12 = crypto.PKCS12()
            cert_p12.set_privatekey(cert_key)
            cert_p12.set_certificate(cert_cer)
            cert_p12 = cert_p12.export(pfx_pass)
            cert_pri = crypto.dump_privatekey(crypto.FILETYPE_PEM, cert_key).decode('utf - 8')
            cert_pem = crypto.dump_certificate(crypto.FILETYPE_PEM, cert_cer).decode('utf - 8')
            main_pem = crypto.dump_certificate(crypto.FILETYPE_PEM, main_cer) + b"\n"
        else:
            cert_cer = cert_cer.sign(main_key, hashes.SHA256())
            cert_pri = cert_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption()
            ).decode()
            cert_pem = cert_cer.public_bytes(serialization.Encoding.PEM).decode()
            cert_sha = str(hex(cert_cer.serial_number))[2:]
            main_pem = main_cer.public_bytes(serialization.Encoding.PEM)
            cert_p12 = pkcs12.serialize_key_and_certificates(
                name=name_cer.encode(),  # 友好名称
                key=cert_key,
                cert=cert_cer,
                cas=None,  # 中间证书
                encryption_algorithm=serialization.BestAvailableEncryption(pfx_pass.encode())
            )
        save_dir = out + "%s/" % cert_sha
        with open("test.crt", "w") as save_file:
            save_file.write(cert_pem)
        os.makedirs(save_dir)
        # 写入文件 ====================================================================================
        with open("saves/%s.crt" % cert_sha, 'w', encoding='utf8') as f:
            f.write(cert_pem)
        with open(save_dir + 'certificate.crt', 'w', encoding='utf8') as f:
            f.write(cert_pem)
        with open(save_dir + 'private_key.pem', 'w') as f:
            f.write(cert_pri)
        with open(save_dir + "certificate.pfx", "wb") as f:
            f.write(cert_p12)
        with open(save_dir + "certificate.txt", "wb") as f:
            f.write("PFX File Password: ".encode() + pfx_pass.encode())
        with open(save_dir + "cert_chains.crt", "wb") as f:
            f.write(main_pem)
            with open(use['urlSign']['root'] + ".crt") as t:
                f.write(t.read().encode())
        # 时间证书写入 ---------------------------------------------------------------------------------
        if ca_name == "time":
            with open(save_dir + 'tsa.crt', 'w', encoding='utf8') as f:
                f.write(cert_pem)
            with open(save_dir + 'tsa.key', 'w') as f:
                f.write(cert_pri)
        # .ZIP文件写入 ---------------------------------------------------------------------------------
        with zipfile.ZipFile(save_dir[:-1] + ".zip", mode='w') as zips:
            for file_name in os.listdir(save_dir):
                zips.write(save_dir + file_name, arcname=file_name)
        shutil.rmtree(save_dir)
        return True, save_dir

    @staticmethod
    @app.route('/cert/', methods=['GET'])
    def issuePage():
        try:
            captcha = request.args.get('captcha')  # captcha
            captchaClient = CaptchaClient(APP_ID, APP_SECRET)
            captchaClient.setTimeOut(2)
            # 设置超时时间，默认2秒
            captchaClient.setCaptchaUrl("https://cap.dingxiang-inc.com/api/tokenVerify")
            # 指定服务器地址，saas可在控制台，应用管理页面最上方获取
            response = captchaClient.checkToken(captcha)
            if not response['result']:
                return {
                    "done": False,
                    "text": "Captcha Verify Failed"
                }, 401
        except (TypeError, ValueError, Exception) as err:
            return {
                "done": False,
                "text": "Captcha Verify Failed"
            }, 500

        try:
            va_time = int(request.args.get('va_time'))  # 时间
            ca_name = request.args.get('ca_name')  # 机构-名称
            in_mail = request.args.get('in_mail')  # 邮件-地址
            in_code = request.args.get('in_code')  # 国家-代码
            in_main = request.args.get('in_main')  # 省份-名称
            in_subs = request.args.get('in_subs')  # 城市-名称
            in_orgs = request.args.get('in_orgs')  # 组织-名称
            in_part = request.args.get('in_part')  # 部门-名称
            in_data = request.args.get('in_data')  # 备注-信息
            in_coms = request.args.get('in_coms')  # 备注-信息
            in_coms = in_coms.replace(",", ";").replace(" ", ";")
            in_coms = in_coms.replace("，", ";").replace("；", ";")
        except (TypeError, ValueError, Exception) as err:
            return {
                "done": False,
                "text": "Params Error"
            }, 500
        try:
            flag, text = Cert.issueCert(ca_name, va_time, in_mail,
                                        in_code, in_main, in_subs,
                                        in_orgs, in_part, in_data,
                                        in_coms)
            if flag and len(text) > 0:
                return send_file(text[:-1] + ".zip")
            else:
                return {
                    "done": False,
                    "text": "Issuing Error: %s" % text
                }, 500
        except (TypeError, ValueError, Exception) as err:
            traceback.print_exc()
            return {
                "done": False,
                "text": "Issuing Error: %s" % str(err)
            }, 500


if __name__ == '__main__':
    # Cert.issueCert("time", 1, "1", "CN", "1", "1", "1", "1", "1", use_old=True)
    for new in ["certs", "saves"]:
        if not os.path.exists(new):
            os.makedirs(new)
    cos = CORS(app, resources={r"/*": {"origins": "*"}})
    app.run(debug=True,
            host='0.0.0.0',
            port=1007,
            use_reloader=False)
