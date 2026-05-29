# SSH Tunnel Setup for Devices on Same Network

Setting up SSHFS to access M1's filesystem from M2 over an encrypted SSH tunnel on the same local network.

## Machines
This might be different for your case.

**M1**
- Host: HP Pavilion Laptop 15-eh2xxx
- OS: Ubuntu 24.04.4 LTS x86_64
- Kernel: 6.14.0-37-generic
- CPU: AMD Ryzen 5 5625U with Radeon Graphics (12) @ 4.390GHz
- RAM: 15GB

**M2**
- Host: Victus by HP Gaming Laptop 15-fa1xxx
- OS: Ubuntu 24.04.4 LTS x86_64
- Kernel: 6.17.0-29-generic
- CPU: 12th Gen Intel i7-12650H (16) @ 4.600GHz
- RAM: 15GB

## Goal

Access M1's filesystem from M2 (`M2 → M1`) using SSHFS over an encrypted SSH tunnel.

## Setup

### 1. Enable SSH Server on M1

```bash
sudo apt install openssh-server -y
sudo systemctl enable ssh
sudo systemctl start ssh
```

### 2. Generate SSH Key on M2

```bash
ssh-keygen -t ed25519 -C "<key-label>" -f ~/.ssh/<key-name>
```

### 3. Copy M2's Public Key to M1

```bash
ssh-copy-id -i ~/.ssh/<key-name>.pub <m1-user>@<m1-local-ip>
```

### 4. Configure SSH on M2

Add the following to `~/.ssh/config` on M2:

```
Host <alias>
    HostName <m1-local-ip>
    User <m1-user>
    IdentityFile ~/.ssh/<key-name>
    IdentitiesOnly yes
```

### 5. Test SSH Connection from M2

```bash
ssh <alias>
```

### 6. Install SSHFS on M2

```bash
sudo apt install sshfs -y
```

### 7. Create Mount Point on M2

```bash
mkdir <m2-mount-path>
```

## Usage

### Mount M1's filesystem

```bash
sshfs <alias>:<m1-path-to-mount> <m2-mount-path>
```

### Unmount

```bash
fusermount -u <m2-mount-path>
```

## Static IP for M1

Assigning a static IP to M1 ensures the tunnel doesn't break if the router reassigns a different IP after a reboot.

### If you own the WiFi router

Look up DHCP reservation for your specific router model and assign M1 a fixed IP based on its MAC address.

To get M1's MAC address:
```bash
ip link show | grep -A1 "ether" | grep "ether"
```

### If you don't own the WiFi router

Set the static IP directly on M1 using NetworkManager.

First find your active connection name and current gateway:
```bash
nmcli con show
ip route | grep default
```

Then apply the static IP:
```bash
nmcli con mod "<connection-name>" ipv4.addresses <desired-ip>/24
nmcli con mod "<connection-name>" ipv4.gateway <gateway-ip>
nmcli con mod "<connection-name>" ipv4.dns "8.8.8.8 8.8.4.4"
nmcli con mod "<connection-name>" ipv4.method manual
nmcli con up "<connection-name>"
```

Verify it took effect:
```bash
hostname -I
```

The desired IP should appear as the first entry.

## Notes

- Edits made inside `<m2-mount-path>` on M2 are reflected on M1 in real time — it is a live mount, not a copy.
- The mount does not survive a reboot. Re-run the `sshfs` command after restart.
- The SSH tunnel stays alive in the background as long as the mount is active.
