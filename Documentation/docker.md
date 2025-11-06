sudo service docker start
sudo docker build -t eva-app .
docker run -p 3000:3000 -v "$(pwd):/app" eva-app