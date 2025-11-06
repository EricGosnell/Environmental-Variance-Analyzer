sudo service docker start
sudo docker build -t eva-app .
sudo docker run -p 3000:3000 eva-app