import random
import string

class DynamicScenarioGenerator:
    def __init__(self):
        self.vulnerability_classes = [
            "stack_buffer_overflow",
            "heap_buffer_overflow",
            "off_by_one",
            "integer_overflow",
            "null_deref"
        ]
        self.sanitizers = {
            "stack_buffer_overflow": "address",
            "heap_buffer_overflow": "address",
            "off_by_one": "address",
            "integer_overflow": "undefined",
            "null_deref": "undefined"
        }

    def _rand_str(self, length=8):
        return ''.join(random.choices(string.ascii_lowercase, k=length))

    def generate(self):
        vuln_type = random.choice(self.vulnerability_classes)
        var_name = self._rand_str(6)
        buf_size = random.randint(8, 64)
        overflow_size = buf_size + random.randint(10, 100)
        
        if vuln_type == "stack_buffer_overflow":
            vuln_code = f"""
#include <cstring>
int main() {{
    char {var_name}[{buf_size}];
    const char* input = "{"A" * overflow_size}";
    std::memcpy({var_name}, input, {overflow_size});
    return 0;
}}
"""
            patch_code = f"""
#include <cstring>
#include <algorithm>
int main() {{
    char {var_name}[{buf_size}];
    const char* input = "{"A" * overflow_size}";
    std::memcpy({var_name}, input, std::min((size_t){overflow_size}, (size_t){buf_size}));
    return 0;
}}
"""
        elif vuln_type == "heap_buffer_overflow":
            vuln_code = f"""
#include <cstdlib>
#include <cstring>
int main() {{
    char* {var_name} = (char*)std::malloc({buf_size});
    std::memcpy({var_name}, "{"A" * overflow_size}", {overflow_size});
    std::free({var_name});
    return 0;
}}
"""
            patch_code = f"""
#include <cstdlib>
#include <cstring>
int main() {{
    char* {var_name} = (char*)std::malloc({overflow_size + 1});
    std::memcpy({var_name}, "{"A" * overflow_size}", {overflow_size});
    std::free({var_name});
    return 0;
}}
"""
        elif vuln_type == "off_by_one":
            vuln_code = f"""
int main() {{
    int {var_name}[{buf_size}];
    for(int i=0; i<={buf_size}; i++) {{
        {var_name}[i] = 0;
    }}
    return 0;
}}
"""
            patch_code = f"""
int main() {{
    int {var_name}[{buf_size}];
    for(int i=0; i<{buf_size}; i++) {{
        {var_name}[i] = 0;
    }}
    return 0;
}}
"""
        elif vuln_type == "integer_overflow":
            vuln_code = f"""
#include <climits>
int main() {{
    int {var_name} = INT_MAX;
    int result = {var_name} + 1;
    return 0;
}}
"""
            patch_code = f"""
#include <climits>
int main() {{
    long long {var_name} = INT_MAX;
    long long result = {var_name} + 1;
    return 0;
}}
"""
        elif vuln_type == "null_deref":
            vuln_code = f"""
int main() {{
    int* {var_name} = nullptr;
    return *{var_name};
}}
"""
            patch_code = f"""
int main() {{
    int* {var_name} = nullptr;
    if ({var_name}) return *{var_name};
    return 0;
}}
"""
        else:
            return self.generate() # Retry

        return {
            "type": vuln_type,
            "sanitizer": self.sanitizers[vuln_type],
            "vuln_code": vuln_code.strip(),
            "patch_code": patch_code.strip()
        }
