# WSL UbuntuのDocker Engineで起動する

WindowsのWSL Ubuntu内にDocker Engineを導入してTaskOtterを動かす手順です。wslc.exeを使用せず、Windowsブラウザで `http://localhost:3000` を開きます。既存のPowerShell／wslc方式も引き続き利用できます。Docker Desktopとホスト側のNode.jsは不要です。

## 1. WSL Ubuntuを用意する

WindowsのPowerShellで確認します。

```powershell
wsl --list --verbose
```

Ubuntuがなければ、管理者PowerShellでインストールします。以下はUbuntu 24.04の例です。既存Ubuntuがある場合はインストール不要です。

```powershell
wsl --install -d Ubuntu-24.04
```

UbuntuのVERSIONが1ならWSL 2へ変更します。ディストリビューション名は `wsl --list --verbose` の表示に合わせてください。

```powershell
wsl --set-version Ubuntu-24.04 2
wsl -d Ubuntu-24.04
```

以降の `sh`・`sudo`・`docker` コマンドはUbuntuのターミナルで実行します。

## 2. systemdを確認する

Ubuntuで次を確認します。

```sh
ps -p 1 -o comm=
```

`systemd` が表示されれば変更不要です。異なる場合は `sudo nano /etc/wsl.conf` で既存設定を保ちながら、`[boot]` セクションに次を設定します。

```ini
[boot]
systemd=true
```

Ubuntuの作業を終了してからWindowsのPowerShellで `wsl --shutdown` を実行し、Ubuntuを開き直します。この操作は他のWSLインスタンスも停止するため、実行前にそこでの作業も保存してください。[Microsoftのsystemd手順](https://learn.microsoft.com/en-us/windows/wsl/systemd) を参照。

## 3. Docker Engineをインストールする

Ubuntuの公式Dockerリポジトリを使用します。[Docker公式のUbuntu向け手順](https://docs.docker.com/engine/install/ubuntu/) を確認してください。既にローカルDocker Engineが動いている場合は導入作業を省略できます。既存の `docker.io`・`podman-docker` 等がある場合は公式手順の競合パッケージを確認し、必要なものだけ整理してください。この手順から既存Dockerデータを削除する操作は行いません。

Ubuntuで実行：

```sh
sudo apt update
sudo apt install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

次のリポジトリ設定を作成します。

```sh
sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF_DOCKER
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF_DOCKER
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
sudo docker run --rm hello-world
```

TaskOtterのスクリプトでDockerだけにsudoを使うには、Ubuntuのターミナルで次を設定します。この設定はそのターミナルで有効です。スクリプト自体をsudoで起動する必要はありません。

```sh
export TASKOTTER_DOCKER_SUDO=1
```

既に `docker info` がsudoなしで成功する場合、この設定は不要です。dockerグループによる利用も選べますが、そのグループはroot相当の権限を持つため、[公式の導入後手順](https://docs.docker.com/engine/install/linux-postinstall/) に従って判断してください。スクリプトはグループの変更やDockerのインストールを自動実行しません。

## 4. ビルド・初期化・起動

Ubuntuのターミナルでプロジェクトディレクトリに移動します。ビルド対象は共通の `Containerfile` です。ソースはUbuntuの `~/...` 配下でも、Windowsの `/mnt/c/...` 配下でも使用できます。

```sh
cd '/mnt/c/Users/YOUR_NAME/Projects/TaskOtter'
sh scripts/run-wsl-docker.sh build
```

保存先にはWindowsのディレクトリを `/mnt/c/...` 形式で指定できます。空白・日本語を含む場合も引用符で囲みます。

```sh
TASKOTTER_DATA_DIR='/mnt/c/Users/YOUR_NAME/Documents/TaskOtter data'
sh scripts/run-wsl-docker.sh init "$TASKOTTER_DATA_DIR"
sh scripts/run-wsl-docker.sh up "$TASKOTTER_DATA_DIR" 3000
```

`init` は初回のみです。既存の `taskotter.json` がある場合は実行せず、`up` から始めます。初期化は既存ファイルを上書きしません。保存先の省略はエラーになり、既定の保存先は作りません。

Windowsブラウザで `http://localhost:3000` を開きます。Windows側の保存ファイルは `C:\Users\YOUR_NAME\Documents\TaskOtter data\taskotter.json` です。Ubuntu内のディレクトリを使用したい場合は `TASKOTTER_DATA_DIR="$HOME/TaskOtter data"` のように指定します。コンテナはUbuntu利用者のUID/GIDで実行し、Ubuntu内に作るデータファイルをその利用者が編集できるようにします。

スクリプトはUbuntuのDocker Engineへ `127.0.0.1:3000:3000` で公開します。WindowsからWSLアプリへのlocalhost接続は [Microsoftのネットワーク資料](https://learn.microsoft.com/en-us/windows/wsl/networking) に記載されています。Windowsのファイアウォールを開放する操作は不要です。

## 5. 停止・再開・更新

```sh
sh scripts/run-wsl-docker.sh status
sh scripts/run-wsl-docker.sh logs
sh scripts/run-wsl-docker.sh stop
sh scripts/run-wsl-docker.sh start
```

イメージ更新：

```sh
sh scripts/run-wsl-docker.sh stop
sh scripts/run-wsl-docker.sh delete
sh scripts/run-wsl-docker.sh build
sh scripts/run-wsl-docker.sh up "$TASKOTTER_DATA_DIR" 3000
```

コンテナ名は `taskotter-docker` です。`delete` はコンテナだけを削除し、保存先のディレクトリやJSONを削除しません。保存先変更もstop/delete/upで再作成します。既存データを引き継ぐ場合は、停止後にJSONを新しい保存先へコピーし、initは実行しません。

WSLやWindowsを再起動した後は、Ubuntuを開き、必要に応じて `sudo systemctl start docker`、`export TASKOTTER_DOCKER_SUDO=1`、`sh scripts/run-wsl-docker.sh start` を実行します。Windows起動時のUbuntu・アプリの自動起動設定は追加していません。

## 6. wslc方式から切り替える

同じ保存先を使えばデータを移行せず利用できます。PowerShellの `.\scripts\run-windows.ps1 stop` で従来のコンテナを停止し、UbuntuでDocker用イメージをbuildして同じWindows保存先を `/mnt/c/...` でupします。既存JSONにはinitを実行しません。両方式のイメージとコンテナは別管理です。

同じポート・同じJSONを両方式から同時使用しないでください。旧方式の停止に失敗した場合は、状態を確認して停止してから切り替えます。試すだけなら別の保存先と別ポートを指定できます。

## トラブル確認・検証範囲

Ubuntuで次を確認します。

```sh
sudo systemctl status docker
sudo docker info
sh scripts/run-wsl-docker.sh status
sh scripts/run-wsl-docker.sh logs
curl -i http://127.0.0.1:3000/api/data
```

- 権限エラー：`export TASKOTTER_DOCKER_SUDO=1` を設定する。
- デーモンに接続できない：systemdとDockerサービスの状態を確認する。Docker Desktopの接続先ではなく、このUbuntu内のEngineを使用する。
- ポート競合：既存のTaskOtterを停止するか、upの最後の引数を3001などへ変更する。
- 保存できない：保存先のアクセス権とログを確認する。既存のroot所有ファイルを使う場合は、そのファイルの所有者・権限を確認する。スクリプトは既存ファイルを自動でchownしない。
- Ubuntu内のcurlは成功するのにWindowsブラウザで開けない：WSLのlocalhost接続設定やWindows側のポート競合を確認する。公開先を0.0.0.0へ変更せず、上記のMicrosoft資料で確認する。

この開発環境にはDocker Engine・Windows・WSLがないため、実際のイメージビルド、Windows保存先のマウント、Windowsブラウザへの接続は未検証です。スクリプトの引数・保存先処理・失敗処理はDockerを代替した自動テストで検証します。
