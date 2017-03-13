#! /bin/bash

mkdir -p proxy/cert
cd proxy/cert

# Create proxy root certificate authority (key)
openssl genrsa -out proxy.key.pem 1024

# Create self-signed certificate for root authority
openssl req -x509 \
    -new \
    -nodes \
    -days 365000 \
    -signkey proxy.key.pem \
    -subj "/C=RU/ST=Russia/L=Moscow/O=JaxSnoop/OU=proxy/CN=localhost.com/emailAddress=localhost@localhost.com"
    -out proxy.root.crt.pem

# I will use the same key as certificate authority and as server private key

# Create a request from server, which will be signed by root authority
openssl req \
    -new \
    -key proxy.key.pem \
    -out proxy.csr \
    -subj "/C=RU/ST=Russia/L=Moscow/O=JaxSnoop/OU=proxy/CN=localhost.com/emailAddress=${FQDN}"

# Sign the server request with root CA
openssl x509 -req \
    -days 365000 \
    -in proxy.csr \
    -CA proxy.root.crt.pem \
    -CAkey proxy.key.pem \
    -CAcreateserial \
    -out proxy.crt.pem

cd ../../
