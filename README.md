# rosmon

**ROS2 topology graph web app** — nodes, topics, services, and actions via **rosmon_bridge**.  
*ROS2 토폴로지 그래프 웹 앱: 노드·토픽·서비스·액션 연결 시각화.*

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![ROS2](https://img.shields.io/badge/ROS%202-Jazzy-orange)](https://docs.ros.org/)

---

## Overview

**rosmon** is a **web app** (React) that connects to ROS2 via **rosmon_bridge** (Python WebSocket server) and provides a **topology graph**: nodes and their connections (topics, services, actions). Run the app in a browser; **rosmon_bridge** must be running on the ROS2 side.

## Features

- **Topic, service, action** — View in topology and inspect (interface definition, copy CLI).
- **Publish** — Publish messages to topics from the UI.
- **Request** — Call services (send request, see response).
- **Feedback** — Send action goals and observe feedback stream in real time.

## Prerequisites

- **Node.js** — LTS (v22+), see [.nvmrc](.nvmrc) if using nvm
- **ROS2** — Jazzy (rosmon_bridge).
- **Browser** — modern browser (Chrome, Firefox, Edge) with WebSocket support

## How to start

Install [nvm](https://github.com/nvm-sh/nvm) before start. 

1. Install **Node** from nvm

```bash
nvm install
```

2. install **npm dependencies**

```bash
npm install
```

3. **Activate ROS2 environment** and Python dependencies for rosmon_bridge:

```bash
source /opt/ros/jazzy/setup.bash   # or your ROS_DISTRO (e.g. humble)

# Install rclpy
sudo apt install ros-$ROS_DISTRO-rclpy

# Activate your python env then,
pip install -r requirements.txt
```

4. **Run** (Vite dev server + rosmon_bridge):

```bash
npm run dev
```
Open `http://localhost:5173`. The app connects to `ws://localhost:9090` by default.

## Contributing

Contributions are welcome. Please open an issue first for larger changes, 

1. Fork the repo  
2. Create a branch (`git checkout -b feature/your-feature`)  
3. Commit your changes (`git commit -m 'Add some feature'`)  
4. Push and open a Pull Request  

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Related

- [ROS 2 CLI / Introspection](https://docs.ros.org/en/humble/Concepts/Basic/About-Command-Line-Tools.html)
- [ros-tooling/graph-monitor](https://github.com/ros-tooling/graph-monitor)
