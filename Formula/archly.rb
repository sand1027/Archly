class Archly < Formula
  desc "Headless CLI for Archly — AI architecture diagrams and database ERDs"
  homepage "https://github.com/sand1027/Archly"
  version "0.1.0"
  license "MIT"

  head do
    url "https://github.com/sand1027/Archly.git", branch: "main"
  end

  on_macos do
    on_arm do
      url "https://github.com/sand1027/Archly/releases/download/v0.1.0/archly_darwin_arm64.tar.gz"
      sha256 "c6c73d6927981e7be02de7faadc927d641f5b4309a025551c71a868e837395bd"
    end
    on_intel do
      url "https://github.com/sand1027/Archly/releases/download/v0.1.0/archly_darwin_amd64.tar.gz"
      sha256 "876cfb6dc28b430e9b690253ba9139053dff55ffe1ebd77bfc908b891b5d9639"
    end
  end

  on_linux do
    on_arm do
      url "https://github.com/sand1027/Archly/releases/download/v0.1.0/archly_linux_arm64.tar.gz"
      sha256 "a697c8a0205b59257a339f2172af50a0444f8cfbd6a7bec01986cc23a9c7f67f"
    end
    on_intel do
      url "https://github.com/sand1027/Archly/releases/download/v0.1.0/archly_linux_amd64.tar.gz"
      sha256 "6752d676f8319c9a8c17a2c88d1aaceb0ecacfcab663eb16483b6b711cac3fd1"
    end
  end

  depends_on "go" => :build if build.head?

  def install
    if build.head?
      cd "archly-cli" do
        system "go", "build", *std_go_args(ldflags: "-s -w -X main.version=HEAD")
      end
      return
    end

    bin.install "archly"
  end

  test do
    out = shell_output("#{bin}/archly version")
    assert_match(/\d+\.\d+/, out)
  end
end
