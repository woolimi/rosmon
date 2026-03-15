# rosmon

**ROS2 topology graph web app** — nodes, topics, services, and actions via **rosmon_bridge**.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![ROS2](https://img.shields.io/badge/ROS%202-Jazzy-orange)](https://docs.ros.org/)

---

![demo](/docs/demo.gif)

## Overview

**rosmon** is a **web app** (React) that connects to ROS2 via **rosmon_bridge** (Python WebSocket server) and provides a **topology graph**: nodes and their connections (topics, services, actions). Run the app in a browser; **rosmon_bridge** must be running on the ROS2 side.

## Features

- Topology visualization: Visualize the relationships between nodes, topics, services, and actions using a custom bridge socket server (rosmon_bridge).

- Topic publish: Inspect the topic interface and publish test messages directly from the UI.

- Service request: Send requests and inspect responses for services.

- Action feedback: Send goals, observe the feedback stream in real time, and check the final result.

## Prerequisites

- **Node.js** — LTS (v22+)
- **ROS2** — Jazzy (rosmon_bridge).
- **Browser** — modern browser (Chrome, Firefox, Edge) with WebSocket support

## How to start

Install [nvm](https://github.com/nvm-sh/nvm) before start. 

0. Clone repository

```bash
git clone git@github.com:woolimi/rosmon.git
cd rosmon
```

1. Install recommended version of **Node** from nvm

```bash
nvm install
```

2. install **npm dependencies**

```bash
npm install
```

3. **Activate ROS2 environment** and Python dependencies for rosmon_bridge:

```bash
source /opt/ros/$ROS_DISTRO/setup.bash

# Activate a Python environment depending on your setup
# Example:
#   conda activate ros
#   source ~/venv/ros/bin/activate

pip install -r requirements.txt
```

4. **Run** (Vite dev server + rosmon_bridge):

```bash
npm run dev
```

This command starts both the Vite development server and the rosmon_bridge socket server.

Open http://localhost:5173. The app connects to ws://localhost:9090 by default.

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
