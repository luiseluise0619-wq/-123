#include <cstring>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

constexpr std::size_t kBufferSize = 128;

// 의도적으로 취약한 기준 구현: 128바이트 버퍼에 최대 511바이트까지 복사할 수 있습니다.
void process_packet_vulnerable(const char* net_input, std::size_t len) {
    char packet_buf[kBufferSize];
    if (len < 512) {
        std::memcpy(packet_buf, net_input, len);
    }
}

// 실제 패치 구현: 입력 크기를 먼저 거부하고, 허용된 크기만 별도 버퍼에 복사합니다.
void process_packet_safe(const std::vector<char>& net_input) {
    if (net_input.size() > kBufferSize) {
        throw std::runtime_error("packet exceeds 128-byte safety limit");
    }
    std::vector<char> packet_buf(net_input.size());
    if (!net_input.empty()) {
        std::memcpy(packet_buf.data(), net_input.data(), net_input.size());
    }
}

}  // namespace

int main(int argc, char** argv) {
    const std::string mode = argc > 1 ? argv[1] : "--vulnerable";
    constexpr std::size_t input_size = 200;
    const std::vector<char> input(input_size, 'A');

    std::cout << "AegisAI execution verification harness\n";
    std::cout << "mode=" << mode << " input_bytes=" << input_size
              << " buffer_bytes=" << kBufferSize << "\n";

    if (mode == "--safe") {
        try {
            process_packet_safe(input);
            std::cout << "PATCH_RESULT=unexpectedly_allowed\n";
            return 2;
        } catch (const std::exception& error) {
            std::cout << "PATCH_RESULT=blocked\n";
            std::cout << "reason=" << error.what() << "\n";
            return 0;
        }
    }

    if (mode != "--vulnerable") {
        std::cerr << "usage: " << argv[0] << " [--vulnerable|--safe]\n";
        return 64;
    }

    std::cout << "VULNERABLE_RESULT=calling_memcpy\n";
    process_packet_vulnerable(input.data(), input.size());
    std::cout << "VULNERABLE_RESULT=unexpectedly_returned\n";
    return 2;
}
