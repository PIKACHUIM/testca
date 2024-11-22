from flask_cors import CORS
from flask import Flask, request
from OpenSSL import crypto

app = Flask(__name__)
pem = {
    "time": "",
    "uefi": "",
    "code": ""
}
CORS(app)


class Server:
    @staticmethod
    def issueCert():
        key = crypto.PKey()
        key.generate_key(crypto.TYPE_RSA, 2048)

        # 创建一个自签名证书
        cert = crypto.X509()
        cert.get_subject().C = "CN"
        cert.get_subject().ST = "State"
        cert.get_subject().L = "Location"
        cert.get_subject().O = "Organization"
        cert.get_subject().OU = "Organizational Unit"
        cert.get_subject().CN = "Common Name"
        cert.get_subject().emailAddress  = "Common Name"
        cert.set_serial_number(1000)
        cert.set_notBefore(b'20000101000000Z')
        cert.set_notAfter(b'20241231235959Z')
        cert.set_issuer(cert.get_subject())
        cert.set_pubkey(key)
        cert.add_extensions([
            crypto.X509Extension(
                b"basicConstraints",
                True, b"CA:TRUE"),
            crypto.X509Extension(
                b"keyUsage", True,
                b"digitalSignature, keyCertSign"),
            crypto.X509Extension(
                b"extendedKeyUsage", True,
                b"serverAuth,clientAuth"),
            # crypto.X509Extension(
            #     b"subjectAltName", False,
            #     b"otherName:2.5.4.41;UTF8String:Name,otherName:2.5.4.13;UTF8String:Description"),
            crypto.X509Extension(
                b"subjectAltName", False,
                b"DNS:Name,URI:Description"),
            crypto.X509Extension(
                b"crlDistributionPoints", False,
                b"URI:https://pikachuim.github.io/testca/certs/codeca/codeca.crl,URI:https://test.certs.us.kg/certs/codeca/codeca.crl"),
            crypto.X509Extension(
                b"authorityInfoAccess", False,
                b"OCSP;URI:https://test.ocsps.us.kg/, caIssuers;URI:https://test.certs.us.kg/certs/codeca/codeca.crt, caIssuers;URI:https://pikachuim.github.io/testca/certs/codeca/codeca.crt"),
            # crypto.X509Extension(
            #     b"certificatePolicies", False,
            #     b"1.2.4.5, 1.3.6.1.4.1.37476.9000.173.0;URI:https://test.certs.us.kg/"),
            # crypto.X509Extension(
            #     b"", False,
            #     b""),
            # crypto.X509Extension(
            #     b"", False,
            #     b""),
        ])

        cert.sign(key, 'sha256')
        with open('cache/certificate.crt', 'w', encoding='utf8') as f:
            f.write(crypto.dump_certificate(crypto.FILETYPE_PEM, cert).decode('utf - 8'))
        with open('cache/private_key.pem', 'w') as f:
            f.write(crypto.dump_privatekey(crypto.FILETYPE_PEM, key).decode('utf - 8'))

    @staticmethod
    @app.route('/', methods=['GET'])
    def issuePage():
        ca_name = request.args.get('ca_name')
        va_time = request.args.get('va_time')
        in_data = request.args.get('in_data')
        in_code = request.args.get('in_code')
        in_main = request.args.get('in_main')
        in_subs = request.args.get('in_subs')
        in_orgs = request.args.get('in_orgs')
        in_orgu = request.args.get('in_orgu')


if __name__ == '__main__':
    Server.issueCert()
    # cos = CORS(app, resources={r"/*": {"origins": "*"}})
    # app.run(debug=True,
    #         host='0.0.0.0',
    #         port=1080,
    #         use_reloader=False)
