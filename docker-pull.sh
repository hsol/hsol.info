sudo docker stop hsol-info
sudo docker rm hsol-info
sudo docker pull hansollim/hsol.info:latest
sudo docker run --name hsol-info --env-file .env -p 1996:3000 -p 520:8000 -itd hansollim/hsol.info
