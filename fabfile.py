from fabric.api import env, run, local, cd, sudo, put

# fabric settings
env.use_ssh_config = True

# deploy dir
dev = '/root/s195-graph'

# server list
env.hosts = ['neo']

def deploy():
	with cd(dev):
		sudo('git pull origin master')

def start():
	with cd(dev):
		sudo('')

def stop():
	with cd(dev):
		sudo('')
