FROM nginx
ADD html /usr/share/nginx/html
ADD default.conf /etc/nginx/conf.d/
ENV http_proxy=http://web-proxy.corp.hpecorp.net:8080
ENV https_proxy=http://web-proxy.corp.hpecorp.net:8080

RUN apt-get update
RUN apt-get install -y curl
