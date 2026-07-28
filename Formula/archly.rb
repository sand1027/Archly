class Archly < Formula
  desc "Headless CLI for Archly — AI architecture diagrams and database ERDs"
  homepage "https://github.com/sand1027/Archly"
  license "MIT"

  head do
    url "https://github.com/sand1027/Archly.git", branch: "main"
  end

  depends_on "go" => :build

  def install
    cd "archly-cli" do
      system "go", "build", *std_go_args(ldflags: "-s -w -X main.version=HEAD")
    end
  end

  test do
    out = shell_output("#{bin}/archly version")
    assert_match(/\S+/, out)
  end
end
