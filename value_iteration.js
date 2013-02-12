$(document).ready(function(){
	table.setup();			
})

var states = {
	regular: {
		reward: -1
	},
	wall: {
		reward: -4
	},
	diamond: {
		reward: 10
	},
	swamp: {
		reward: -10
	}
};

var actions = {
	up: {
		i: 0,
		j: -1
	},
	down: {
		i: 0,
		j: 1
	},
	left: {
		i: -1,
		j: 0
	},
	right: {
		i: 1,
		j: 0
	}
}

var table = {
	m: null,
	n: null,
	setup: function(){
		table.m = parseInt($('input[name=size-row]').val());
		table.n = parseInt($('input[name=size-col]').val());
		console.log('Setup table or size '+table.m+' by '+table.n+'...');				
		var table_tag = $('<table id="grid"></table>').appendTo('#table-wrapper');
		var count = 0;
		for (var i = 0; i < (table.m+2); i++){
			var row = $('<tr></tr>').attr('row', i).appendTo(table_tag);
			if ((i==0) || (i==(table.m+1))){
				$(row).addClass('wall');
			}
			for (var j = 0; j < (table.n+2); j++){						
				var cell = $('<td></td>').attr('col', j).attr('id', 'cell-'+count).attr('state','regular').hide().appendTo(row).fadeIn();
				if ((j==0) || (j==(table.n+1)) || (i==0) || (i==(table.m+1))){
					$(cell).addClass('wall').attr('state', 'wall');
				}else{
					$(cell).addClass('changeable').addClass('grid-cell');
					$('<div class="action-value action-value-up"></div>').appendTo(cell);
					$('<div class="action-value action-value-left"></div>').appendTo(cell);
					$('<div class="state-value"></div>').appendTo(cell);
					$('<div class="action-value action-value-right"></div>').appendTo(cell);
					$('<div class="action-value action-value-down"></div>').appendTo(cell);
				}
				count++;
			}
		}
		
		table.setUI();
	},
	reset: function(){				
		console.log('reset table...');
		$('#table-wrapper').empty();
		table.setup();
	},
	setUI: function(){
		console.log('- Setup UI...');
		
		$('.changeable').click(function(e){
			var s = $(this).attr('state');
			var ss = Object.keys(states);
			$(this).attr('state', ss[(ss.indexOf(s)+1)%ss.length]);
		})
		
		if ($('#state-rewards').find('tr').length==0){
			for (var state in states){					
				var row = $('<tr></tr>').appendTo('#state-rewards');
				$('<td class="caption"></td>').attr('state', state).html(state).appendTo(row);
				$('<td class="input"></td>').html('<input type="text" name="'+state+'" size="4" value="'+states[state].reward+'">').appendTo(row);
			}
		}				
		
		$('#edge-display-control').empty().html('<input type="radio" name="edge-display" value="policy" checked="checked"> Policy <input type="radio" name="edge-display" value="q"> Q(s,a)');
		$('input[name=edge-display]').click(function(e){
			
		})
		
		
		$('#main-control').empty();
		var reset = $('<a href="#" id="reset"></a>').html('reset').hide().appendTo('#main-control').click(function(e){
			e.preventDefault();
			table.reset();
		})
		
		$('input').focus(function(e){
			reset.fadeIn();
		})
		
		$('<a href="#" id="start"></a>').html('start').appendTo('#main-control').click(function(e){
			e.preventDefault();
			reset.fadeIn();
			ValueIteration.begin();
			$('.changeable').unbind('click').removeClass('changeable');
			$(this).hide();			
			
			for (var state in states){
				states[state].reward = parseInt($('input[name='+state+']').val());
			}			
		})
	}
};

var ValueIteration = {
	discount: parseFloat($('input[name=discount]').val()),
	tolerance: parseFloat($('input[name=tolerance]').val()),
	pi: {},
	Q: {},
	V: {},
	V_new: {},
	begin: function(){
		ValueIteration.discount = parseFloat($('input[name=discount]').val());
		ValueIteration.tolerance = parseFloat($('input[name=tolerance]').val());
		
		for (var state in states){
			var r = parseFloat($('input[name='+state+']').val());
			if (isNaN(r)){
				states[state].reward = r;
			}
		}
		$.each($('.grid-cell'), function(i,v){
			var pi_0 = {};
			var q_0 = {};
			for (var action in actions){
				pi_0[action] = 1.0/(Object.keys(actions).length);
				q_0[action] = 0.0;
			}
			
			var s_id = $(v).attr('id');
			
			console.log(i+": "+$(v).attr('id')+', state='+$(v).attr('state'));
			// init policy
			ValueIteration.pi[s_id] = pi_0;
			ValueIteration.V[s_id] = 0.0;
			ValueIteration.Q[s_id] = q_0;
			
			$(v).find('.state-value').html(ValueIteration.V[s_id]);
			if ($('input[name=edge-display]:checked').val()=='policy'){					
				$(v).updatePi(pi_0);
			}else{
				$(v).updateQ(q_0);
			}					
		})
		
		$('<div id="delta"></div>').html('Delta:').appendTo('#table-wrapper');
		
		$('<a href="#" id="iterate" class="table-control"></a>').html('Iterate').insertBefore('#reset').click(function(e){
			ValueIteration.iterate();
		});
	},
	iterate: function(){
		var delta = ValueIteration.evaluate();
		$('#delta').html('Delta: '+delta);
		while (delta > ValueIteration.tolerance){
			$('#delta').html('Delta: '+delta);
			delta = ValueIteration.evaluate();
		}
		ValueIteration.improve();
	},
	evaluate: function(){
		var delta = 0;
		$.each($('.grid-cell'), function(i,v){
			$(v).css({opacity:0.5});
			var s_id = $(v).attr('id');	
			console.log('s_id: '+s_id);				
			var v_current = ValueIteration.V[s_id];
			var v_new = 0;
			for (var action in actions){
				var s_next_id = ValueIteration.transition(s_id, actions[action]); 
				console.log('next_id: '+s_next_id);
				var s_next = $('#'+s_next_id);						
				var r = states[$(s_next).attr('state')].reward;
				console.log('reward = '+r);
				if (s_next.attr('state')=='wall'){
					s_next = v; //stay in the current state if bumped into the wall
					s_next_id = s_id;							
				}
				// $(s_next).addClass('current-neighbor');
				var target = ValueIteration.V[s_next_id]*ValueIteration.discount;
				var R = r+target
				v_new += ValueIteration.pi[s_id][action]*R;
				ValueIteration.Q[s_id][action] = R;
				// $(s_next).removeClass('current-neighbor');
			}
			var v_diff = Math.abs(v_new - v_current);
			if (v_diff > delta){
				delta = v_diff;
			}
			ValueIteration.V_new[s_id] = v_new;
			console.log('Updating value at cell id: '+s_id+' with v_new='+v_new);
			$(v).find('.state-value').html(ValueIteration.V_new[s_id].toFixed(1));
			$(v).css({opacity:1.0});
		});
		ValueIteration.V = ValueIteration.V_new;
		ValueIteration.V_new = {};
		return delta;
	},
	transition: function(s_id, action){
		return 'cell-'+(parseInt(s_id.split('-')[1])+(table.n+2)*(action.j)+action.i);
	},
	improve: function(){
		console.log('Policy improvement');
		$.each($('.grid-cell'), function(i,v){
			var action_opt = [];
			var q_max = -99999;
			var s_id = $(v).attr('id');
			for (var action in actions){
				var q = ValueIteration.Q[s_id][action];
				if (q > q_max){
					q_max = q;
					action_opt = [action];
				}else if (q == q_max){
					action_opt[action_opt.length] = action;
				}												
			}
			var N = action_opt.length;
			if (N>0){
				for (action in actions){
					if (action_opt.indexOf(action)>=0){
						ValueIteration.pi[s_id][action] = 1.0/N;
					}else{
						ValueIteration.pi[s_id][action] = 0.0;
					}
				}
				//console.log('policy improved:'+s_id);
			}
			
			if ($('input[name=edge-display]:checked').val()=='q'){					
				$(v).updateQ(ValueIteration.Q[s_id]);
			}
			
			if ($('input[name=edge-display]:checked').val()=='policy'){					
				$(v).updatePi(ValueIteration.pi[s_id]);
			}					
		})
	}
}

jQuery.fn.updatePi = function(pi_s){
	this.find('.action-value-up').css({opacity: pi_s.up*0.75+0.25}).html(pi_s.up.toFixed(2)*100+'%');
	this.find('.action-value-left').css({opacity: pi_s.left*0.75+0.25}).html(pi_s.left.toFixed(2)*100+'%');
	this.find('.action-value-right').css({opacity: pi_s.right*0.75+0.25}).html(pi_s.right.toFixed(2)*100+'%');
	this.find('.action-value-down').css({opacity: pi_s.down*0.75+0.25}).html(pi_s.down.toFixed(2)*100+'%');
};

jQuery.fn.updateQ = function(q){
	this.find('.action-value-up').html(q.up.toFixed(2));
	this.find('.action-value-left').html(q.left.toFixed(2));
	this.find('.action-value-right').html(q.right.toFixed(2));
	this.find('.action-value-down').html(q.down.toFixed(2));
};