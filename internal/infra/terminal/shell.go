package terminal

import (
	"context"
	"os/exec"
	"runtime"
)

// ShellManager gerencia a execução de comandos do sistema operacional
type ShellManager struct {
	Ctx context.Context
}

// ExecuteCommand roda um comando simples sem prender a thread (Ideal para comandos rápidos no PowerShell/Bash)
func (s *ShellManager) ExecuteCommand(command string) (string, error) {
	var cmd *exec.Cmd

	// Verifica o sistema operacional para instanciar o shell correto
	if runtime.GOOS == "windows" {
		cmd = exec.CommandContext(s.Ctx, "powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command)
	} else {
		cmd = exec.CommandContext(s.Ctx, "bash", "-c", command)
	}

	// Executa e aguarda a saída (CombinedOutput junta Stdout e Stderr)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), err
	}

	return string(output), nil
}
