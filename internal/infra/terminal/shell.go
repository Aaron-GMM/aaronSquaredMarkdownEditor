package terminal

import (
	"context"
	"io"
	"os/exec"
	"runtime"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ShellSession mantém o estado do processo nativo do terminal
type ShellSession struct {
	ctx   context.Context
	cmd   *exec.Cmd
	stdin io.WriteCloser
}

// NewShellSession inicia o terminal (Bash ou PS) e mantém o processo aberto
// NewShellSession inicia o terminal e mantém o processo aberto
func NewShellSession(ctx context.Context) (*ShellSession, error) {
	var cmd *exec.Cmd

	if runtime.GOOS == "windows" {
		// -NoExit impede que o PowerShell morra imediatamente
		cmd = exec.Command("powershell.exe", "-NoProfile", "-NoExit")
	} else {
		// -i força o bash a entrar no modo Interativo, evitando que feche sozinho
		cmd = exec.Command("bash", "-i")
	}

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}

	cmd.Stderr = cmd.Stdout

	if err := cmd.Start(); err != nil {
		return nil, err
	}

	session := &ShellSession{
		ctx:   ctx,
		cmd:   cmd,
		stdin: stdin,
	}

	// Goroutine: Roda em paralelo escutando tudo que o terminal cospe
	go func() {
		buf := make([]byte, 1024)
		for {
			n, err := stdout.Read(buf)
			if n > 0 {
				wailsRuntime.EventsEmit(ctx, "terminal:output", string(buf[:n]))
			}
			if err != nil {
				wailsRuntime.EventsEmit(ctx, "terminal:output", "\r\n[Sessão do terminal encerrada pelo SO]\r\n")
				break
			}
		}
	}()

	return session, nil
}

// Write injeta caracteres no terminal (o que o usuário digitou)
func (s *ShellSession) Write(input string) error {
	_, err := s.stdin.Write([]byte(input))
	return err
}

// Close mata o processo zumbi forçadamente (Critério do RF05)
func (s *ShellSession) Close() error {
	if s.stdin != nil {
		s.stdin.Close()
	}
	if s.cmd != nil && s.cmd.Process != nil {
		return s.cmd.Process.Kill()
	}
	return nil
}
