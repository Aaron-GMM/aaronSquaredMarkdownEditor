package service

import (
	"strings"

	"gopkg.in/yaml.v3"
)

// ExtractFrontmatter extracts the YAML frontmatter from a markdown string
// Returns the parsed metadata, the markdown content without the frontmatter, and any error.
func ExtractFrontmatter(content string) (map[string]interface{}, string, error) {
	if !strings.HasPrefix(content, "---\n") && !strings.HasPrefix(content, "---\r\n") {
		return nil, content, nil // no frontmatter
	}

	parts := strings.SplitN(content, "---", 3)
	if len(parts) < 3 {
		return nil, content, nil // incomplete frontmatter
	}

	yamlBlock := parts[1]
	body := strings.TrimPrefix(parts[2], "\n")
	body = strings.TrimPrefix(body, "\r\n")

	var metadata map[string]interface{}
	err := yaml.Unmarshal([]byte(yamlBlock), &metadata)
	if err != nil {
		return nil, content, err
	}

	return metadata, body, nil
}
